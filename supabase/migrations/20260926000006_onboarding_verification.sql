-- Phase 1: onboarding, verification, admin review, email outbox (PLAN.md §5.1).

create extension if not exists pg_net;

---------------------------------------------------------------------------
-- Email outbox
--
-- RPCs enqueue rows here; an AFTER INSERT trigger pings the send-email edge
-- function through pg_net (delivered after commit). The function URL and a
-- shared secret live in Vault:
--   send_email_url     e.g. https://<ref>.supabase.co/functions/v1/send-email
--   email_hook_secret  must match the function's EMAIL_HOOK_SECRET
-- If either is missing, rows simply stay pending.
---------------------------------------------------------------------------
create type public.email_status as enum ('pending', 'sent', 'failed');

create table public.email_outbox (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete set null,
  to_email   text not null,
  template   text not null check (template in
               ('account_shared', 'verification_approved', 'verification_rejected', 'new_match')),
  payload    jsonb not null default '{}'::jsonb,
  status     public.email_status not null default 'pending',
  attempts   int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);

alter table public.email_outbox enable row level security;
create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';

create function private.dispatch_email() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  fn_url text;
  secret text;
begin
  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'send_email_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'email_hook_secret';
  if fn_url is null or secret is null then
    return null;
  end if;

  perform net.http_post(
    url     := fn_url,
    body    := jsonb_build_object('id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kollide-secret', secret)
  );
  return null;
exception when others then
  -- Email must never break the business transaction that queued it.
  raise warning 'email dispatch failed for %: %', new.id, sqlerrm;
  return null;
end;
$$;

create trigger email_outbox_dispatch
  after insert on public.email_outbox
  for each row execute function private.dispatch_email();

create function private.enqueue_email(uid uuid, tmpl text, data jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  addr text := (select email from public.profile_private where user_id = uid);
begin
  if addr is null then
    return;
  end if;
  insert into public.email_outbox (user_id, to_email, template, payload)
  values (uid, addr, tmpl, coalesce(data, '{}'::jsonb));
end;
$$;

---------------------------------------------------------------------------
-- Normalization (§5.1 step 2). Stored values are always normalized, so ban
-- checks and ban creation compare like with like.
---------------------------------------------------------------------------
-- Indian mobile numbers only for the pilot → +91XXXXXXXXXX, or null if invalid.
create function private.normalize_phone(raw text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  d text := regexp_replace(coalesce(raw, ''), '\D', '', 'g');
begin
  if length(d) = 12 and left(d, 2) = '91' then
    d := substr(d, 3);
  elsif length(d) = 11 and left(d, 1) = '0' then
    d := substr(d, 2);
  end if;
  return case when d ~ '^[6-9][0-9]{9}$' then '+91' || d end;
end;
$$;

-- Social usernames: lowercase, no profile-URL prefix, no @, no whitespace.
create function private.normalize_handle(raw text) returns text
language sql immutable set search_path = '' as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        lower(btrim(coalesce(raw, ''))),
        '^(https?://)?(www\.)?(instagram\.com/|snapchat\.com/add/|t\.me/|telegram\.me/)', ''),
      '[@\s/]', '', 'g'),
    '');
$$;

-- True if any of the user's normalized identifiers is on the ban list.
create function private.has_ban(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profile_private pp
    join public.bans b on
         (b.kind = 'email' and b.value_normalized = lower(btrim(pp.email)))
      or (b.kind = 'phone' and b.value_normalized = pp.phone)
      or (b.kind::text in ('instagram', 'snapchat', 'whatsapp', 'telegram')
          and b.value_normalized = pp.socials ->> b.kind::text)
    where pp.user_id = uid
  );
$$;

---------------------------------------------------------------------------
-- Signup: log the funnel event alongside the existing row creation.
---------------------------------------------------------------------------
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.profile_private (user_id, email) values (new.id, lower(btrim(new.email)));
  insert into public.events_log (user_id, name) values (new.id, 'signup');
  return new;
end;
$$;

---------------------------------------------------------------------------
-- Onboarding step RPCs. Progress is saved after each step; complete_onboarding
-- re-validates everything server-side.
---------------------------------------------------------------------------
create function private.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in to continue' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function public.save_basics(
  p_first_name text,
  p_dob date,
  p_gender public.gender,
  p_seeking public.seeking,
  p_gender_preference public.gender[],
  p_consent boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  name text := btrim(coalesce(p_first_name, ''));
begin
  if char_length(name) not between 1 and 50 then
    raise exception 'Please enter your first name (up to 50 characters)' using errcode = '22023';
  end if;
  if p_dob is null or p_dob > current_date - interval '18 years' then
    raise exception 'You must be 18 or older to use Kollide' using errcode = '22023';
  end if;
  if p_dob < current_date - interval '100 years' then
    raise exception 'Please check your date of birth' using errcode = '22023';
  end if;
  if p_gender is null or p_seeking is null then
    raise exception 'Please choose your gender and what you''re looking for' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_gender_preference), 0) = 0 then
    raise exception 'Please choose who you''d like to meet' using errcode = '22023';
  end if;
  if not coalesce(p_consent, false)
     and (select consent_at from public.profiles where id = uid) is null then
    raise exception 'Please accept the Privacy Policy and Terms to continue' using errcode = '22023';
  end if;

  update public.profiles set
    first_name        = name,
    dob               = p_dob,
    gender            = p_gender,
    seeking           = p_seeking,
    gender_preference = (select array_agg(distinct g) from unnest(p_gender_preference) g),
    consent_at        = coalesce(consent_at, now())
  where id = uid;
end;
$$;

create function public.save_contact(p_phone text, p_socials jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  v_phone text := private.normalize_phone(p_phone);
  v_socials jsonb := '{}'::jsonb;
  k text;
  v text;
begin
  if v_phone is null then
    raise exception 'Please enter a valid 10-digit Indian mobile number' using errcode = '22023';
  end if;

  foreach k in array array['instagram', 'snapchat', 'whatsapp', 'telegram'] loop
    continue when coalesce(btrim(p_socials ->> k), '') = '';
    if k = 'whatsapp' then
      v := private.normalize_phone(p_socials ->> k);
      if v is null then
        raise exception 'Please enter a valid WhatsApp number' using errcode = '22023';
      end if;
    else
      v := private.normalize_handle(p_socials ->> k);
      if v is null or v !~ '^[a-z0-9._-]{1,50}$' then
        raise exception 'Please check your % username', initcap(k) using errcode = '22023';
      end if;
    end if;
    v_socials := v_socials || jsonb_build_object(k, v);
  end loop;

  if v_socials = '{}'::jsonb then
    raise exception 'Please add at least one social handle' using errcode = '22023';
  end if;

  update public.profile_private set phone = v_phone, socials = v_socials
  where user_id = uid;
end;
$$;

-- Reorder the caller's photos: p_ids lists every photo id in the new order.
create function public.reorder_photos(p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  if (select count(*) from public.photos where user_id = uid) <> coalesce(cardinality(p_ids), 0)
     or exists (
       select 1 from unnest(p_ids) i
       where not exists (select 1 from public.photos p where p.id = i and p.user_id = uid)
     ) then
    raise exception 'Photo list is out of date, please refresh' using errcode = '22023';
  end if;

  set constraints public.photos_user_position_key deferred;
  update public.photos p set position = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where p.id = o.id and p.user_id = uid;
end;
$$;

-- Once onboarded, a user can't drop below the 2-photo minimum.
create function private.enforce_min_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select onboarding_complete from public.profiles where id = old.user_id)
     and (select count(*) from public.photos where user_id = old.user_id) < 2 then
    raise exception 'You need at least 2 photos' using errcode = '22023';
  end if;
  return null;
end;
$$;

create constraint trigger photos_min_count
  after delete on public.photos
  deferrable initially immediate
  for each row execute function private.enforce_min_photos();

create function public.complete_onboarding() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  p public.profiles;
  pp public.profile_private;
  photo_count int;
begin
  select * into p from public.profiles where id = uid for update;
  if p.onboarding_complete then
    return;
  end if;
  select * into pp from public.profile_private where user_id = uid;
  photo_count := (select count(*) from public.photos where user_id = uid);

  if p.first_name is null or p.gender is null or p.seeking is null
     or p.gender_preference is null or p.consent_at is null then
    raise exception 'Please finish the basics step first' using errcode = '22023';
  end if;
  if p.dob is null or p.dob > current_date - interval '18 years' then
    raise exception 'You must be 18 or older to use Kollide' using errcode = '22023';
  end if;
  if photo_count < 2 then
    raise exception 'Please add at least 2 photos' using errcode = '22023';
  end if;
  if pp.phone is null or pp.phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Please add a valid phone number' using errcode = '22023';
  end if;
  if pp.socials = '{}'::jsonb then
    raise exception 'Please add at least one social handle' using errcode = '22023';
  end if;
  if not exists (select 1 from public.user_activities where user_id = uid) then
    raise exception 'Please pick at least one activity' using errcode = '22023';
  end if;

  -- Generic on purpose: never reveal which identifier matched.
  if p.is_banned or private.has_ban(uid) then
    raise exception 'We couldn''t complete your signup. If you think this is a mistake, contact support.'
      using errcode = 'KL001';
  end if;

  update public.profiles set onboarding_complete = true where id = uid;
  insert into public.events_log (user_id, name) values (uid, 'onboarding_complete');

  perform private.enqueue_email(uid, 'account_shared', jsonb_build_object(
    'first_name',  p.first_name,
    'email',       pp.email,
    'phone',       pp.phone,
    'socials',     pp.socials,
    'dob',         p.dob,
    'photo_count', photo_count
  ));
end;
$$;

---------------------------------------------------------------------------
-- Verification
---------------------------------------------------------------------------
create function public.submit_verification(p_storage_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  p public.profiles;
begin
  select * into p from public.profiles where id = uid for update;

  if not p.onboarding_complete or p.is_banned then
    raise exception 'Please finish your profile first' using errcode = '22023';
  end if;
  if p.verification_status = 'approved' then
    raise exception 'You''re already verified' using errcode = '22023';
  end if;
  if p.verification_status = 'pending' then
    raise exception 'Your video is already being reviewed' using errcode = '22023';
  end if;
  if (select count(*) from public.verification_videos where user_id = uid) >= 2 then
    raise exception 'You''ve already used your one resubmission. Please contact support.'
      using errcode = '22023';
  end if;
  if p_storage_path !~ ('^' || uid::text || '/[0-9a-f-]{36}\.(webm|mp4)$') then
    raise exception 'Invalid video path' using errcode = '22023';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'verification-videos' and name = p_storage_path
  ) then
    raise exception 'Video upload not found, please record again' using errcode = '22023';
  end if;

  insert into public.verification_videos (user_id, storage_path) values (uid, p_storage_path);
  update public.profiles set verification_status = 'pending' where id = uid;
  insert into public.events_log (user_id, name) values (uid, 'video_submitted');
end;
$$;

create function private.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Admins only' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

-- Pending videos, oldest first, with the photos reviewers compare against.
create function public.admin_verification_queue()
returns table (
  video_id         uuid,
  user_id          uuid,
  first_name       text,
  public_code      text,
  age              int,
  gender           public.gender,
  submitted_at     timestamptz,
  is_resubmission  boolean,
  photo_paths      text[]
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select
      v.id,
      p.id,
      p.first_name,
      p.public_code::text,
      extract(year from age(p.dob))::int,
      p.gender,
      v.created_at,
      exists (select 1 from public.verification_videos o
              where o.user_id = p.id and o.status = 'rejected'),
      coalesce((select array_agg(ph.storage_path order by ph.position)
                from public.photos ph where ph.user_id = p.id), '{}')
    from public.verification_videos v
    join public.profiles p on p.id = v.user_id
    where v.status = 'pending'
    order by v.created_at;
end;
$$;

create function public.admin_review_verification(p_user_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := private.require_admin();
  video public.verification_videos;
  reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  if p_user_id = admin_uid then
    raise exception 'You can''t review your own verification' using errcode = '42501';
  end if;
  if not p_approve and reason is null then
    raise exception 'Please give a reason for rejecting' using errcode = '22023';
  end if;

  select * into video from public.verification_videos
  where user_id = p_user_id and status = 'pending'
  for update;
  if not found then
    raise exception 'This user has no video waiting for review' using errcode = '22023';
  end if;

  update public.verification_videos set
    status        = case when p_approve then 'approved' else 'rejected' end::public.video_status,
    reviewed_by   = admin_uid,
    reviewed_at   = now(),
    reject_reason = case when p_approve then null else reason end,
    delete_after  = now() + case when p_approve then interval '48 hours' else interval '30 days' end
  where id = video.id;

  update public.profiles set
    verification_status = case when p_approve then 'approved' else 'rejected' end::public.verification_status,
    verified_by         = case when p_approve then admin_uid end,
    verified_at         = case when p_approve then now() end
  where id = p_user_id;

  insert into public.admin_access_log (admin_id, action, target_type, target_id)
  values (admin_uid, 'review_verification', 'verification_video', video.id);

  if p_approve then
    insert into public.events_log (user_id, name) values (p_user_id, 'verified');
    perform private.enqueue_email(p_user_id, 'verification_approved',
      jsonb_build_object('first_name', (select first_name from public.profiles where id = p_user_id)));
  else
    perform private.enqueue_email(p_user_id, 'verification_rejected', jsonb_build_object(
      'first_name', (select first_name from public.profiles where id = p_user_id),
      'reason', reason,
      'can_resubmit', (select count(*) from public.verification_videos where user_id = p_user_id) < 2
    ));
  end if;
end;
$$;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.dispatch_email(), private.enqueue_email(uuid, text, jsonb),
  private.normalize_phone(text), private.normalize_handle(text), private.has_ban(uuid),
  private.enforce_min_photos(), private.require_uid(), private.require_admin()
from public;
grant execute on function private.require_uid(), private.require_admin() to authenticated;

grant execute on function
  public.save_basics(text, date, public.gender, public.seeking, public.gender[], boolean),
  public.save_contact(text, jsonb),
  public.reorder_photos(uuid[]),
  public.complete_onboarding(),
  public.submit_verification(text),
  public.admin_verification_queue(),
  public.admin_review_verification(uuid, boolean, text)
to authenticated;
