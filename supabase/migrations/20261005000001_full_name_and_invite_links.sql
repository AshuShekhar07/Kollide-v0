-- Full name at signup, and shareable group invite links.
--
-- Full name: onboarding asks for the user's full name. It's kept private in
-- profile_private (owner and admins only, for verification); the public
-- profile still shows only the first name next to the public code (§2.1).
--
-- Invite links: a group admin can share a link (/join/<token>). Anyone with
-- it sees a short preview of the group; once signed up and verified they can
-- ask to join through it, and the admin approves as usual (§2.1 joining).
-- Tokens live in their own table with no client access, so browsing groups
-- never reveals them; the admin can reset a leaked link.

---------------------------------------------------------------------------
-- Full name
---------------------------------------------------------------------------
alter table public.profile_private
  add column full_name text check (char_length(full_name) between 1 and 80);

drop function public.save_basics(text, date, public.gender, public.seeking, public.gender[], boolean);

-- The first word of the full name becomes the public first name.
create function public.save_basics(
  p_full_name text,
  p_dob date,
  p_gender public.gender,
  p_seeking public.seeking,
  p_gender_preference public.gender[],
  p_consent boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  v_full text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_first text := split_part(v_full, ' ', 1);
begin
  if char_length(v_full) not between 1 and 80 then
    raise exception 'Please enter your full name (up to 80 characters)' using errcode = '22023';
  end if;
  if v_full ~ '[0-9@_/\\]' then
    raise exception 'Please enter your name as it appears on your ID' using errcode = '22023';
  end if;
  if char_length(v_first) > 50 then
    raise exception 'Please check your first name (up to 50 characters)' using errcode = '22023';
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
    first_name        = v_first,
    dob               = p_dob,
    gender            = p_gender,
    seeking           = p_seeking,
    gender_preference = (select array_agg(distinct g) from unnest(p_gender_preference) g),
    consent_at        = coalesce(consent_at, now())
  where id = uid;

  update public.profile_private set full_name = v_full where user_id = uid;
end;
$$;

---------------------------------------------------------------------------
-- Invite links
---------------------------------------------------------------------------
create table public.group_invite_links (
  group_id   uuid primary key references public.groups (id) on delete cascade,
  token      text not null unique,
  created_at timestamptz not null default now()
);
alter table public.group_invite_links enable row level security;
-- No policies or grants: only the functions below touch it.

-- Did this person ask to join through the invite link? Shown to the admin.
alter table public.group_members add column via_link boolean not null default false;

-- 22 URL-safe characters (122 random bits).
create function private.new_invite_token() returns text
language sql volatile set search_path = '' as $$
  select rtrim(translate(encode(uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'), '=');
$$;

-- The group's link token, created on first use. Admin only.
create function public.get_group_invite_link(p_group_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
  tok text;
begin
  perform private.require_group_admin(g.id, uid);
  if g.status = 'closed' then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  insert into public.group_invite_links (group_id, token)
  values (g.id, private.new_invite_token())
  on conflict (group_id) do nothing;
  select token into tok from public.group_invite_links where group_id = g.id;
  return tok;
end;
$$;

-- Replaces the token, so the old link stops working. Admin only.
create function public.reset_group_invite_link(p_group_id uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
  tok text := private.new_invite_token();
begin
  perform private.require_group_admin(g.id, uid);
  if g.status = 'closed' then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  insert into public.group_invite_links (group_id, token)
  values (g.id, tok)
  on conflict (group_id) do update set token = excluded.token, created_at = now();
  return tok;
end;
$$;

-- Preview for /join/:token, open to anyone holding the link (signed in or
-- not). Returns null for an unknown token, a closed group, or a group whose
-- admin is blocked either way. Verified callers also get the group id and
-- their own membership status; everyone else sees only the basics.
create function public.get_group_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  g public.groups;
  verified boolean := uid is not null and private.is_active_approved(uid);
  mine public.group_member_status;
begin
  select gr.* into g
  from public.group_invite_links l
  join public.groups gr on gr.id = l.group_id
  where l.token = p_token;
  if not found or g.status = 'closed' then
    return null;
  end if;
  if uid is not null and g.admin_id is not null and private.is_blocked_between(uid, g.admin_id) then
    return null;
  end if;
  if verified then
    select status into mine from public.group_members where group_id = g.id and user_id = uid;
  end if;

  return jsonb_build_object(
    'title',         g.title,
    'activity_name', (select a.name from public.activities a where a.id = g.activity_id),
    'event_date',    g.event_date,
    'status',        g.status,
    'member_count',  private.group_member_count(g.id),
    'max_members',   g.max_members,
    'admin_name',    (select p.first_name from public.profiles p where p.id = g.admin_id),
    'group_id',      case when verified then g.id end,
    'my_status',     mine
  );
end;
$$;

-- Shared by request_join and request_join_by_link. The caller is verified
-- and holds the group lock.
create function private.request_join(g public.groups, uid uuid, p_via_link boolean)
returns public.group_member_status
language plpgsql security definer set search_path = '' as $$
declare
  cur public.group_member_status;
begin
  if not private.can_see_group(g, uid) or g.status = 'closed' then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;

  select status into cur from public.group_members where group_id = g.id and user_id = uid;
  case cur
    when 'approved' then
      raise exception 'You''re already in this group' using errcode = '22023';
    when 'requested' then
      raise exception 'You''ve already asked to join. The admin will get back to you.' using errcode = '22023';
    when 'rejected', 'removed' then
      raise exception 'You can''t ask to join this group again' using errcode = '22023';
    when 'invited' then
      perform private.admit_member(g, uid);
      insert into public.notifications (user_id, type, payload)
      values (g.admin_id, 'group_invite_accepted', jsonb_build_object('group_id', g.id, 'user_id', uid));
      return 'approved';
    else
      null;
  end case;

  if g.status = 'full' then
    raise exception 'This group is full' using errcode = '22023';
  end if;

  insert into public.group_members (group_id, user_id, status, via_link)
  values (g.id, uid, 'requested', p_via_link)
  on conflict (group_id, user_id) do update
    set status = 'requested', created_at = now(), approved_at = null, via_link = excluded.via_link;

  insert into public.notifications (user_id, type, payload)
  values (g.admin_id, 'group_join_request',
          jsonb_build_object('group_id', g.id, 'user_id', uid, 'via_link', p_via_link));
  return 'requested';
end;
$$;

-- Same behaviour as before; now a thin wrapper.
create or replace function public.request_join(p_group_id uuid) returns public.group_member_status
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
begin
  return private.request_join(private.lock_group(p_group_id), uid, false);
end;
$$;

-- Ask to join through an invite link. Returns {group_id, status}.
create function public.request_join_by_link(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  gid uuid;
  st public.group_member_status;
begin
  select group_id into gid from public.group_invite_links where token = p_token;
  if gid is null then
    raise exception 'This invite link doesn''t work any more. Ask for a new one.' using errcode = '22023';
  end if;
  st := private.request_join(private.lock_group(gid), uid, true);
  return jsonb_build_object('group_id', gid, 'status', st);
end;
$$;

-- get_group_interested gains via_link, so the admin can tell who came from
-- their link.
drop function public.get_group_interested(uuid);
create function public.get_group_interested(p_group_id uuid)
returns table (
  user_id     uuid,
  first_name  text,
  public_code text,
  age         int,
  bio         text,
  seeking     public.seeking,
  photo_paths text[],
  status      public.group_member_status,
  since       timestamptz,
  via_link    boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups;
begin
  select * into g from public.groups where id = p_group_id;
  if not found then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  perform private.require_group_admin(g.id, uid);

  return query
    with people as (
      select m.user_id as id, m.status as st, m.created_at as at, 0 as bucket, m.via_link as vl
      from public.group_members m
      where m.group_id = g.id and m.status in ('requested', 'invited')
      union all
      select * from (
        select ua.user_id, null::public.group_member_status, null::timestamptz, 1, false
        from public.user_activities ua
        join public.profiles p on p.id = ua.user_id
        where ua.activity_id = g.activity_id
          and ua.user_id <> uid
          and not exists (
            select 1 from public.group_members m
            where m.group_id = g.id and m.user_id = ua.user_id
              and m.status in ('approved', 'requested', 'invited', 'removed')
          )
          and private.is_active_approved(ua.user_id)
          and not private.is_blocked_between(uid, ua.user_id)
        order by (p.seeking = 'group') desc, p.created_at desc
        limit 50
      ) candidates
    )
    select p.id, p.first_name, p.public_code::text, extract(year from age(p.dob))::int, p.bio, p.seeking,
           array(select ph.storage_path from public.photos ph where ph.user_id = p.id order by ph.position),
           x.st, x.at, x.vl
    from people x
    join public.profiles p on p.id = x.id
    where private.is_active_approved(p.id) and not private.is_blocked_between(uid, p.id)
    order by x.bucket, x.st, x.vl desc, x.at, (p.seeking = 'group') desc, p.created_at desc;
end;
$$;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.new_invite_token(),
  private.request_join(public.groups, uuid, boolean)
from public;

revoke all on function
  public.save_basics(text, date, public.gender, public.seeking, public.gender[], boolean),
  public.get_group_invite_link(uuid),
  public.reset_group_invite_link(uuid),
  public.get_group_invite(text),
  public.request_join_by_link(text),
  public.get_group_interested(uuid)
from public;

grant execute on function
  public.save_basics(text, date, public.gender, public.seeking, public.gender[], boolean),
  public.get_group_invite_link(uuid),
  public.reset_group_invite_link(uuid),
  public.request_join_by_link(text),
  public.get_group_interested(uuid)
to authenticated;

grant execute on function public.get_group_invite(text) to anon, authenticated;
