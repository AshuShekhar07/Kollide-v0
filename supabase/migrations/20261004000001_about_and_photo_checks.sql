-- "About you" (intro + up to 3 answered questions) and admin re-checks of
-- photos added after verification.

---------------------------------------------------------------------------
-- About you
---------------------------------------------------------------------------
-- The intro (profiles.bio) now goes through save_about(), which validates it.
alter table public.profiles drop constraint profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (char_length(bio) <= 500);
revoke update (bio) on public.profiles from authenticated;

-- Questions people can answer on their profile. Reference data, so it lives
-- here rather than in seed.sql.
create table public.prompts (
  key        text primary key check (key ~ '^[a-z_]{2,40}$'),
  question   text not null,
  sort_order int not null,
  active     boolean not null default true
);

alter table public.prompts enable row level security;
grant select on public.prompts to anon, authenticated;
create policy prompts_select on public.prompts for select to anon, authenticated using (true);

insert into public.prompts (key, question, sort_order) values
  ('perfect_garba_night', 'My perfect Garba night looks like…', 10),
  ('garba_skill',         'My Garba skills, honestly…', 20),
  ('what_i_do',           'What I do all day…', 30),
  ('weekend',             'A typical weekend for me…', 40),
  ('talk_for_hours',      'I could talk for hours about…', 50),
  ('geek_out',            'I geek out on…', 60),
  ('go_to_song',          'My go-to song to dance to…', 70),
  ('best_food',           'The best food in Bangalore is…', 80),
  ('friends_say',         'My friends describe me as…', 90),
  ('looking_for',         'I''m looking for people who…', 100),
  ('green_flag',          'A green flag in a friend…', 110),
  ('unpopular_opinion',   'My unpopular opinion…', 120),
  ('learning',            'Something I''m learning right now…', 130),
  ('simple_pleasures',    'My simple pleasures…', 140),
  ('hidden_talent',       'A hidden talent of mine…', 150),
  ('festival_tradition',  'My favourite festival tradition…', 160),
  ('last_trip',           'The last trip I loved…', 170),
  ('sunday_mornings',     'Sunday mornings are for…', 180),
  ('two_truths',          'Two truths and a lie…', 190),
  ('bucket_list',         'Next on my bucket list…', 200)
on conflict (key) do nothing;

create table public.profile_answers (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  prompt_key text not null references public.prompts (key),
  answer     text not null check (char_length(answer) between 1 and 200),
  position   smallint not null check (position between 0 and 2),
  created_at timestamptz not null default now(),
  primary key (user_id, prompt_key),
  unique (user_id, position)
);

-- Visible wherever the profile is. Writes only through save_about().
alter table public.profile_answers enable row level security;
grant select on public.profile_answers to authenticated;
create policy profile_answers_select on public.profile_answers
  for select to authenticated
  using (private.can_view_profile(user_id));

-- Replaces the caller's intro and answers. p_answers is
-- [{"prompt_key": "...", "answer": "..."}, ...], at most 3, in display order.
create function public.save_about(p_bio text, p_answers jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  v_bio text := btrim(coalesce(p_bio, ''));
  answers jsonb := coalesce(p_answers, '[]'::jsonb);
  a jsonb;
  i int := 0;
begin
  if char_length(v_bio) < 10 then
    raise exception 'Tell people a little more about yourself (at least 10 characters)' using errcode = '22023';
  end if;
  if char_length(v_bio) > 500 then
    raise exception 'Please keep your intro under 500 characters' using errcode = '22023';
  end if;
  if private.contains_url(v_bio) then
    raise exception 'Links aren''t allowed in your profile' using errcode = '22023';
  end if;
  if jsonb_typeof(answers) <> 'array' or jsonb_array_length(answers) > 3 then
    raise exception 'You can answer up to 3 questions' using errcode = '22023';
  end if;
  if (select count(distinct x ->> 'prompt_key') from jsonb_array_elements(answers) x) <> jsonb_array_length(answers) then
    raise exception 'Each question can only be answered once' using errcode = '22023';
  end if;

  delete from public.profile_answers where user_id = uid;
  for a in select * from jsonb_array_elements(answers) loop
    if not exists (select 1 from public.prompts where key = a ->> 'prompt_key' and active) then
      raise exception 'That question isn''t available' using errcode = '22023';
    end if;
    if char_length(btrim(coalesce(a ->> 'answer', ''))) not between 1 and 200 then
      raise exception 'Answers can be 1 to 200 characters' using errcode = '22023';
    end if;
    if private.contains_url(a ->> 'answer') then
      raise exception 'Links aren''t allowed in your profile' using errcode = '22023';
    end if;
    insert into public.profile_answers (user_id, prompt_key, answer, position)
    values (uid, a ->> 'prompt_key', btrim(a ->> 'answer'), i);
    i := i + 1;
  end loop;

  update public.profiles set bio = v_bio where id = uid;
end;
$$;

-- Onboarding now also needs the intro. Same as before plus that one check.
create or replace function public.complete_onboarding() returns void
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
  if char_length(btrim(coalesce(p.bio, ''))) < 10 then
    raise exception 'Please tell people a little about yourself' using errcode = '22023';
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
-- Photos added after verification go live at once, and admins re-check them
-- against the verified photos (a swapped-in face is the risk).
---------------------------------------------------------------------------
alter table public.photos add column checked_at timestamptz;

-- Admin removal may leave someone under the 2-photo minimum.
create or replace function private.enforce_min_photos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('kollide.admin_photo_removal', true) = 'on' then
    return null;
  end if;
  if (select onboarding_complete from public.profiles where id = old.user_id)
     and (select count(*) from public.photos where user_id = old.user_id) < 2 then
    raise exception 'You need at least 2 photos' using errcode = '22023';
  end if;
  return null;
end;
$$;

-- Unchecked photos of verified users added after their verification, oldest
-- first, with the photos they were verified with for comparison.
create function public.admin_new_photos()
returns table (
  photo_id       uuid,
  user_id        uuid,
  first_name     text,
  public_code    text,
  storage_path   text,
  added_at       timestamptz,
  verified_at    timestamptz,
  verified_paths text[]
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select ph.id, p.id, p.first_name, p.public_code::text, ph.storage_path, ph.created_at, p.verified_at,
           array(select o.storage_path from public.photos o
                 where o.user_id = p.id and o.created_at <= p.verified_at order by o.position)
    from public.photos ph
    join public.profiles p on p.id = ph.user_id
    where p.verification_status = 'approved'
      and ph.checked_at is null
      and ph.created_at > p.verified_at
    order by ph.created_at;
end;
$$;

-- Keep marks the photo checked; remove deletes the row and returns its
-- storage path, so the admin client can delete the file.
create function public.admin_review_photo(p_photo_id uuid, p_keep boolean) returns text
language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := private.require_admin();
  ph public.photos;
begin
  select * into ph from public.photos where id = p_photo_id for update;
  if not found then
    raise exception 'This photo is already gone' using errcode = '22023';
  end if;

  insert into public.admin_access_log (admin_id, action, target_type, target_id)
  values (admin_uid, case when p_keep then 'keep_photo' else 'remove_photo' end, 'photo', ph.id);

  if coalesce(p_keep, false) then
    update public.photos set checked_at = now() where id = ph.id;
    return null;
  end if;

  perform set_config('kollide.admin_photo_removal', 'on', true);
  delete from public.photos where id = ph.id;
  perform set_config('kollide.admin_photo_removal', 'off', true);

  insert into public.notifications (user_id, type, payload)
  values (ph.user_id, 'photo_removed', '{}'::jsonb);
  return ph.storage_path;
end;
$$;

-- Admins may delete photo files (after admin_review_photo removes the row).
create policy photos_objects_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and private.is_admin());

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
grant execute on function
  public.save_about(text, jsonb),
  public.admin_new_photos(),
  public.admin_review_photo(uuid, boolean)
to authenticated;
