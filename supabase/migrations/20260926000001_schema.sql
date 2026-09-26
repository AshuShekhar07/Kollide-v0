-- Kollide schema: enums, tables, constraints, indexes (PLAN.md §4.1).
-- RLS is enabled in the next migration; nothing here grants access.

create extension if not exists pgcrypto with schema extensions;

-- Helpers that must not be exposed through PostgREST live in `private`.
create schema if not exists private;

---------------------------------------------------------------------------
-- Enums
---------------------------------------------------------------------------
create type public.gender as enum ('man', 'woman', 'non_binary');
create type public.seeking as enum ('partner', 'friend');
create type public.verification_status as enum ('unsubmitted', 'pending', 'approved', 'rejected');
create type public.activity_status as enum ('live', 'coming_soon');
create type public.video_status as enum ('pending', 'approved', 'rejected');
create type public.swipe_action as enum ('like', 'pass');
create type public.swipe_status as enum ('held', 'pending', 'accepted', 'rejected', 'discarded');
create type public.group_status as enum ('open', 'full', 'closed');
create type public.group_role as enum ('admin', 'member');
create type public.group_member_status as enum ('requested', 'invited', 'approved', 'rejected', 'left', 'removed');
create type public.conversation_kind as enum ('direct', 'group');
create type public.report_reason as enum ('harassment', 'fake_profile', 'inappropriate', 'safety_threat', 'spam', 'other');
create type public.report_status as enum ('open', 'reviewing', 'resolved');
create type public.report_resolution as enum ('no_action', 'warning', 'ban');
create type public.ban_kind as enum ('email', 'phone', 'instagram', 'snapchat', 'whatsapp', 'telegram');

---------------------------------------------------------------------------
-- Profiles
---------------------------------------------------------------------------
-- Rows are created by a trigger on auth.users; onboarding fields stay null
-- until the user fills them in. complete_onboarding() validates completeness.
create table public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  first_name          text check (char_length(btrim(first_name)) between 1 and 50),
  dob                 date check (dob <= current_date - interval '18 years'),
  gender              public.gender,
  gender_preference   public.gender[] check (cardinality(gender_preference) >= 1),
  seeking             public.seeking,
  bio                 text check (char_length(bio) <= 300),
  public_code         char(6) not null unique check (public_code ~ '^[A-HJ-NP-Z]{3}[2-9]{3}$'),
  verification_status public.verification_status not null default 'unsubmitted',
  verified_by         uuid references auth.users (id) on delete set null,
  verified_at         timestamptz,
  is_banned           boolean not null default false,
  plan                text,
  onboarding_complete boolean not null default false,
  -- DPDP consent to the privacy policy/terms, captured at signup (§8).
  consent_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index profiles_discoverable_idx on public.profiles (seeking, gender)
  where verification_status = 'approved' and not is_banned and onboarding_complete;

create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email   text,
  phone   text check (phone ~ '^\+91[6-9][0-9]{9}$'),
  socials jsonb not null default '{}'::jsonb check (jsonb_typeof(socials) = 'object')
);

---------------------------------------------------------------------------
-- Activities
---------------------------------------------------------------------------
create table public.activities (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9_]+$'),
  name       text not null,
  status     public.activity_status not null default 'coming_soon',
  sort_order int not null default 0
);

create table public.user_activities (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  primary key (user_id, activity_id)
);

create index user_activities_activity_idx on public.user_activities (activity_id);

---------------------------------------------------------------------------
-- Photos and verification videos
---------------------------------------------------------------------------
create table public.photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  position     smallint not null check (position between 0 and 5),
  created_at   timestamptz not null default now(),
  -- Deferrable so a reorder can swap positions inside one transaction.
  constraint photos_user_position_key unique (user_id, position) deferrable initially immediate
);

-- user_id is nulled (not cascaded) on account deletion so the cleanup job
-- still finds the file and removes it from storage.
create table public.verification_videos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles (id) on delete set null,
  storage_path  text not null unique,
  status        public.video_status not null default 'pending',
  reviewed_by   uuid references auth.users (id) on delete set null,
  reviewed_at   timestamptz,
  reject_reason text check (char_length(reject_reason) <= 500),
  delete_after  timestamptz,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

create unique index verification_videos_one_pending_idx
  on public.verification_videos (user_id) where status = 'pending';
create index verification_videos_queue_idx
  on public.verification_videos (created_at) where status = 'pending';
create index verification_videos_cleanup_idx
  on public.verification_videos (delete_after) where deleted_at is null;

---------------------------------------------------------------------------
-- Swipes and matches
---------------------------------------------------------------------------
create table public.swipes (
  id           uuid primary key default gen_random_uuid(),
  from_user    uuid not null references public.profiles (id) on delete cascade,
  to_user      uuid not null references public.profiles (id) on delete cascade,
  activity_id  uuid not null references public.activities (id) on delete cascade,
  action       public.swipe_action not null,
  status       public.swipe_status,
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (from_user, to_user, activity_id),
  check (from_user <> to_user),
  -- Likes always carry a status; passes never do.
  check ((action = 'like') = (status is not null))
);

create index swipes_incoming_idx on public.swipes (to_user, status);
create index swipes_outgoing_idx on public.swipes (from_user, status);

create table public.matches (
  id          uuid primary key default gen_random_uuid(),
  user_a      uuid not null references public.profiles (id) on delete cascade,
  user_b      uuid not null references public.profiles (id) on delete cascade,
  activity_id uuid not null references public.activities (id) on delete cascade,
  swipe_id    uuid references public.swipes (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b, activity_id)
);

create index matches_user_b_idx on public.matches (user_b);

---------------------------------------------------------------------------
-- Groups
---------------------------------------------------------------------------
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.profiles (id) on delete set null,
  activity_id uuid not null references public.activities (id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 80),
  description text check (char_length(description) <= 1000),
  event_date  date,
  venue       text check (char_length(venue) <= 200),
  max_members int not null check (max_members between 2 and 10),
  status      public.group_status not null default 'open',
  created_at  timestamptz not null default now()
);

create index groups_browse_idx on public.groups (activity_id, created_at desc) where status = 'open';

create table public.group_members (
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.group_role not null default 'member',
  status      public.group_member_status not null,
  created_at  timestamptz not null default now(),
  approved_at timestamptz,
  primary key (group_id, user_id),
  check (role = 'member' or status in ('approved', 'left', 'removed'))
);

create unique index group_members_one_admin_idx
  on public.group_members (group_id) where role = 'admin' and status = 'approved';
create index group_members_user_idx on public.group_members (user_id, status);

---------------------------------------------------------------------------
-- Conversations and messages
---------------------------------------------------------------------------
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            public.conversation_kind not null,
  match_id        uuid unique references public.matches (id) on delete cascade,
  group_id        uuid unique references public.groups (id) on delete cascade,
  message_cap     int not null check (message_cap > 0),
  message_count   int not null default 0,
  is_frozen       boolean not null default false,
  retained        boolean not null default false,
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  check (
    (kind = 'direct' and match_id is not null and group_id is null) or
    (kind = 'group' and group_id is not null and match_id is null)
  ),
  check (message_count between 0 and message_cap)
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  left_at         timestamptz,
  last_read_at    timestamptz,
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id) where left_at is null;

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.profiles (id) on delete set null,
  body            text not null check (char_length(body) between 1 and 500),
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

---------------------------------------------------------------------------
-- Safety: blocks, reports, bans
---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

-- reporter_id / reported_id deliberately have no FK: reports and their
-- snapshots must survive either party deleting their account (§2.4).
create table public.reports (
  id                 uuid primary key default gen_random_uuid(),
  reporter_id        uuid not null,
  reported_id        uuid not null,
  conversation_id    uuid references public.conversations (id) on delete set null,
  reason             public.report_reason not null,
  details            text check (char_length(details) <= 2000),
  chat_share_consent boolean not null check (chat_share_consent),
  snapshot           jsonb,
  status             public.report_status not null default 'open',
  resolution         public.report_resolution,
  resolved_by        uuid,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  check (reporter_id <> reported_id),
  check ((status = 'resolved') = (resolution is not null))
);

create index reports_queue_idx on public.reports (created_at) where status <> 'resolved';
create index reports_reported_idx on public.reports (reported_id);

create table public.bans (
  id               uuid primary key default gen_random_uuid(),
  kind             public.ban_kind not null,
  value_normalized text not null check (value_normalized <> ''),
  report_id        uuid references public.reports (id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (kind, value_normalized)
);

---------------------------------------------------------------------------
-- Admin
---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- No FK on admin_id: the audit trail outlives the admin account.
create table public.admin_access_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null,
  action      text not null,
  target_type text not null,
  target_id   uuid,
  created_at  timestamptz not null default now()
);

create index admin_access_log_target_idx on public.admin_access_log (target_type, target_id);

create function private.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

create trigger admin_access_log_append_only
  before update or delete on public.admin_access_log
  for each row execute function private.forbid_change();

---------------------------------------------------------------------------
-- Notifications, metrics, config
---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.profile_views (
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_id uuid not null references public.profiles (id) on delete cascade,
  viewed_on date not null default current_date,
  primary key (viewer_id, viewed_on, viewed_id)
);

create table public.events_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  name       text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_log_name_idx on public.events_log (name, created_at);

create table public.app_config (
  key   text primary key,
  value jsonb not null
);

---------------------------------------------------------------------------
-- Public code: 3 letters + 3 digits, e.g. XBY432. Excludes the ambiguous
-- characters I, O, 0 and 1.
---------------------------------------------------------------------------
create function private.generate_public_code() returns trigger
language plpgsql as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  digits  constant text := '23456789';
  candidate text;
begin
  if new.public_code is not null then
    return new;
  end if;
  loop
    candidate :=
      substr(letters, 1 + floor(random() * 24)::int, 1) ||
      substr(letters, 1 + floor(random() * 24)::int, 1) ||
      substr(letters, 1 + floor(random() * 24)::int, 1) ||
      substr(digits,  1 + floor(random() * 8)::int, 1) ||
      substr(digits,  1 + floor(random() * 8)::int, 1) ||
      substr(digits,  1 + floor(random() * 8)::int, 1);
    exit when not exists (select 1 from public.profiles where public_code = candidate);
  end loop;
  new.public_code := candidate;
  return new;
end;
$$;

create trigger profiles_public_code
  before insert on public.profiles
  for each row execute function private.generate_public_code();

-- Every new auth user gets an (empty) profile and private row.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.profile_private (user_id, email) values (new.id, lower(btrim(new.email)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
