-- Local development seed. Loaded by `supabase db reset`.
--
-- Users (all passwords: password123; OTP emails land in local Mailpit):
--   admin@kollide.test            approved + admin
--   approved01..11@kollide.test   approved, onboarded, in Garba
--   pending01..03@kollide.test    video submitted, awaiting review
--   rejected01..02@kollide.test   video rejected
--   banned01..02@kollide.test     approved but banned (with bans rows)
--   fresh01@kollide.test          just signed up, nothing filled in
--   novideo01@kollide.test        onboarded, never submitted a video
--
-- IDs are fixed (00000000-0000-0000-0000-0000000000NN) so tests can refer to them.
-- Photo rows point at storage paths that have no file behind them.

-- Activities and app_config come from migration 20260926000005_reference_data.

---------------------------------------------------------------------------
-- Users
---------------------------------------------------------------------------
do $$
declare
  -- n, email, first_name, gender, prefs, seeking, state
  users constant jsonb := '[
    [1,  "admin",      "Ananya",  "woman",      ["man","woman"],  "friend",  "approved"],
    [2,  "approved01", "Rohan",   "man",        ["woman"],        "partner", "approved"],
    [3,  "approved02", "Priya",   "woman",      ["man"],          "partner", "approved"],
    [4,  "approved03", "Arjun",   "man",        ["woman"],        "partner", "approved"],
    [5,  "approved04", "Meera",   "woman",      ["man"],          "partner", "approved"],
    [6,  "approved05", "Kabir",   "man",        ["man"],          "partner", "approved"],
    [7,  "approved06", "Vikram",  "man",        ["man"],          "partner", "approved"],
    [8,  "approved07", "Sneha",   "woman",      ["woman","man"],  "friend",  "approved"],
    [9,  "approved08", "Isha",    "woman",      ["woman"],        "friend",  "approved"],
    [10, "approved09", "Aditya",  "man",        ["man","woman"],  "friend",  "approved"],
    [11, "approved10", "Sam",     "non_binary", ["man","woman","non_binary"], "friend", "approved"],
    [12, "approved11", "Diya",    "woman",      ["man"],          "partner", "approved"],
    [13, "pending01",  "Karan",   "man",        ["woman"],        "partner", "pending"],
    [14, "pending02",  "Riya",    "woman",      ["man"],          "partner", "pending"],
    [15, "pending03",  "Neha",    "woman",      ["woman","man"],  "friend",  "pending"],
    [16, "rejected01", "Rahul",   "man",        ["woman"],        "partner", "rejected"],
    [17, "rejected02", "Tanya",   "woman",      ["man"],          "partner", "rejected"],
    [18, "banned01",   "Varun",   "man",        ["woman"],        "partner", "banned"],
    [19, "banned02",   "Nikhil",  "man",        ["woman"],        "friend",  "banned"],
    [20, "fresh01",    null,      null,         null,             null,      "fresh"],
    [21, "novideo01",  "Pooja",   "woman",      ["man"],          "partner", "unsubmitted"]
  ]';
  u jsonb;
  uid uuid;
  email text;
  state text;
  garba uuid := (select id from public.activities where slug = 'garba');
  admin_id uuid := '00000000-0000-0000-0000-000000000001';
begin
  for u in select * from jsonb_array_elements(users) loop
    uid   := ('00000000-0000-0000-0000-' || lpad((u->>0), 12, '0'))::uuid;
    email := (u->>1) || '@kollide.test';
    state := u->>6;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      email, extensions.crypt('password123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      now() - ((u->>0)::int || ' days')::interval, now(),
      '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), uid, uid::text, 'email',
      jsonb_build_object('sub', uid::text, 'email', email, 'email_verified', true),
      now(), now(), now()
    );

    -- profiles / profile_private rows were created by the auth trigger.
    continue when state = 'fresh';

    update public.profiles set
      first_name          = u->>2,
      dob                 = date '1998-01-01' + ((u->>0)::int * 97 % 2000),
      gender              = (u->>3)::public.gender,
      gender_preference   = (select array_agg(g::public.gender) from jsonb_array_elements_text(u->4) g),
      seeking             = (u->>5)::public.seeking,
      bio                 = 'Test user ' || (u->>1) || '. Loves Garba nights in Bangalore.',
      onboarding_complete = true,
      consent_at          = now(),
      verification_status = case state
                              when 'approved' then 'approved'
                              when 'banned' then 'approved'
                              when 'pending' then 'pending'
                              when 'rejected' then 'rejected'
                              else 'unsubmitted'
                            end::public.verification_status,
      verified_by         = case when state in ('approved', 'banned') then admin_id end,
      verified_at         = case when state in ('approved', 'banned') then now() - interval '1 day' end,
      is_banned           = state = 'banned'
    where id = uid;

    update public.profile_private set
      phone   = '+9198' || lpad((u->>0), 8, '0'),
      socials = jsonb_build_object('instagram', u->>1)
    where user_id = uid;

    insert into public.user_activities (user_id, activity_id) values (uid, garba);

    insert into public.photos (user_id, storage_path, position) values
      (uid, uid || '/seed-0.jpg', 0),
      (uid, uid || '/seed-1.jpg', 1);

    if state = 'pending' then
      insert into public.verification_videos (user_id, storage_path, status, created_at)
      values (uid, uid || '/seed.webm', 'pending', now() - ((u->>0)::int || ' hours')::interval);
    elsif state = 'rejected' then
      insert into public.verification_videos
        (user_id, storage_path, status, reviewed_by, reviewed_at, reject_reason, delete_after)
      values
        (uid, uid || '/seed.webm', 'rejected', admin_id, now() - interval '1 day',
         'Face not clearly visible', now() + interval '29 days');
    elsif state in ('approved', 'banned') then
      -- Approved videos are already past their 48h window and cleaned up.
      insert into public.verification_videos
        (user_id, storage_path, status, reviewed_by, reviewed_at, delete_after, deleted_at)
      values
        (uid, uid || '/seed.webm', 'approved', admin_id, now() - interval '3 days',
         now() - interval '1 day', now() - interval '1 day');
    end if;
  end loop;

  insert into public.admins (user_id) values (admin_id);
end;
$$;

---------------------------------------------------------------------------
-- A resolved report that produced the bans for banned01
---------------------------------------------------------------------------
with r as (
  insert into public.reports
    (reporter_id, reported_id, reason, details, chat_share_consent, snapshot,
     status, resolution, resolved_by, resolved_at)
  values
    ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000018',
     'harassment', 'Seed report', true, '{"messages": []}',
     'resolved', 'ban', '00000000-0000-0000-0000-000000000001', now())
  returning id
)
insert into public.bans (kind, value_normalized, report_id)
select kind::public.ban_kind, value, r.id
from r, (values
  ('email',     'banned01@kollide.test'),
  ('phone',     '+919800000018'),
  ('instagram', 'banned01'),
  ('email',     'banned02@kollide.test'),
  ('phone',     '+919800000019'),
  ('instagram', 'banned02')
) as b(kind, value);

---------------------------------------------------------------------------
-- Local Vault secrets so queued emails reach the local send-email function
-- (which delivers to Mailpit). Hosted values are set once by hand.
---------------------------------------------------------------------------
select vault.create_secret('http://kong:8000/functions/v1/send-email', 'send_email_url');
select vault.create_secret('local-email-hook-secret', 'email_hook_secret');
