-- Row-Level Security: deny by default (PLAN.md §3, §4).
--
-- Approach:
--   * RLS is enabled on every table in `public`.
--   * All table and function privileges are revoked from anon/authenticated,
--     then granted back table-by-table and column-by-column.
--   * Writes that carry business rules go through SECURITY DEFINER RPCs
--     (added in later phases), never direct table writes.

---------------------------------------------------------------------------
-- Lock down default privileges
---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Future objects created by migrations start with no access either.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon, authenticated;
-- PUBLIC's EXECUTE default is global; a per-schema revoke can't remove it.
alter default privileges for role postgres
  revoke execute on functions from public;

revoke all on schema private from public;
grant usage on schema private to authenticated;

---------------------------------------------------------------------------
-- Enable RLS everywhere
---------------------------------------------------------------------------
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end;
$$;

---------------------------------------------------------------------------
-- Helper predicates (SECURITY DEFINER so policies don't recurse through RLS)
---------------------------------------------------------------------------
create function private.is_admin(uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = uid);
$$;

-- Approved, not banned, onboarded: the only users who appear to others.
create function private.is_active_approved(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.verification_status = 'approved'
      and not p.is_banned
      and p.onboarding_complete
  );
$$;

create function private.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Can the caller see `target`'s profile and photos?
--   * themselves and admins: always
--   * approved callers: any active approved user with no block either way
--   * unverified callers: only profiles get_feed() served them (logged in
--     profile_views), so the daily view limit can't be bypassed.
create function private.can_view_profile(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    target = auth.uid()
    or private.is_admin()
    or (
      private.is_active_approved(target)
      and not private.is_blocked_between(auth.uid(), target)
      and (
        private.is_active_approved(auth.uid())
        or exists (
          select 1 from public.profile_views v
          where v.viewer_id = auth.uid()
            and v.viewed_id = target
            and v.viewed_on >= current_date - 1
        )
      )
    );
$$;

create function private.is_conversation_member(conv uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = auth.uid() and left_at is null
  );
$$;

revoke all on all functions in schema private from public;
grant execute on function
  private.is_admin(uuid),
  private.is_active_approved(uuid),
  private.is_blocked_between(uuid, uuid),
  private.can_view_profile(uuid),
  private.is_conversation_member(uuid)
to authenticated;

---------------------------------------------------------------------------
-- profiles
---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
-- Only user-editable fields. Status, ban, plan, code and onboarding flags
-- are set exclusively by RPCs/triggers.
grant update (first_name, dob, gender, gender_preference, seeking, bio)
  on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (private.can_view_profile(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

---------------------------------------------------------------------------
-- profile_private: owner and admins only. Matched users go through get_contact().
-- Writes happen via onboarding RPCs so values are normalized server-side.
---------------------------------------------------------------------------
grant select on public.profile_private to authenticated;

create policy profile_private_select on public.profile_private
  for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

---------------------------------------------------------------------------
-- activities: public catalogue (landing page reads it logged out)
---------------------------------------------------------------------------
grant select on public.activities to anon, authenticated;

create policy activities_select on public.activities
  for select to anon, authenticated
  using (true);

---------------------------------------------------------------------------
-- user_activities: owner manages their own; visible alongside profiles
---------------------------------------------------------------------------
grant select, insert, delete on public.user_activities to authenticated;

create policy user_activities_select on public.user_activities
  for select to authenticated
  using (private.can_view_profile(user_id));

create policy user_activities_insert_own on public.user_activities
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_activities_delete_own on public.user_activities
  for delete to authenticated
  using (user_id = auth.uid());

---------------------------------------------------------------------------
-- photos: owner manages; visible wherever the profile is visible
---------------------------------------------------------------------------
grant select, insert, delete on public.photos to authenticated;
grant update (position) on public.photos to authenticated;

create policy photos_select on public.photos
  for select to authenticated
  using (private.can_view_profile(user_id));

create policy photos_insert_own on public.photos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and storage_path like auth.uid()::text || '/%'
  );

create policy photos_update_own on public.photos
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy photos_delete_own on public.photos
  for delete to authenticated
  using (user_id = auth.uid());

---------------------------------------------------------------------------
-- verification_videos: owner sees their own row (status); admins see all.
-- Inserts only via submit_verification(). The file itself is never readable
-- except through the admin-video-url edge function.
---------------------------------------------------------------------------
grant select (id, user_id, status, reject_reason, reviewed_at, created_at)
  on public.verification_videos to authenticated;

create policy verification_videos_select on public.verification_videos
  for select to authenticated
  using (user_id = auth.uid() or private.is_admin());

---------------------------------------------------------------------------
-- swipes: no direct access. like/pass/incoming go through RPCs.
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- matches: participants only
---------------------------------------------------------------------------
grant select on public.matches to authenticated;

create policy matches_select on public.matches
  for select to authenticated
  using (auth.uid() in (user_a, user_b));

---------------------------------------------------------------------------
-- groups / group_members: baseline read access; full rules land in Phase 4.
---------------------------------------------------------------------------
grant select on public.groups to authenticated;

create policy groups_select on public.groups
  for select to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.group_members m
      where m.group_id = groups.id and m.user_id = auth.uid()
    )
    or (status <> 'closed' and private.is_active_approved(auth.uid()))
  );

grant select on public.group_members to authenticated;

create policy group_members_select on public.group_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_admin()
    or (status = 'approved' and private.can_view_profile(user_id))
  );

---------------------------------------------------------------------------
-- conversations / members / messages: active members only.
-- Clients never write here directly: send_message() is the only insert path.
---------------------------------------------------------------------------
grant select on public.conversations to authenticated;

create policy conversations_select on public.conversations
  for select to authenticated
  using (private.is_conversation_member(id));

grant select on public.conversation_members to authenticated;
grant update (last_read_at) on public.conversation_members to authenticated;

create policy conversation_members_select on public.conversation_members
  for select to authenticated
  using (private.is_conversation_member(conversation_id));

create policy conversation_members_update_own on public.conversation_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select on public.messages to authenticated;

-- Also hides messages from anyone the reader has blocked (group chats, §2.4).
-- Realtime evaluates this policy per subscriber.
create policy messages_select on public.messages
  for select to authenticated
  using (
    private.is_conversation_member(conversation_id)
    and not exists (
      select 1 from public.blocks b
      where b.blocker_id = auth.uid() and b.blocked_id = sender_id
    )
  );

---------------------------------------------------------------------------
-- blocks: blocker sees their own list (settings screen). Writes via block_user().
---------------------------------------------------------------------------
grant select on public.blocks to authenticated;

create policy blocks_select_own on public.blocks
  for select to authenticated
  using (blocker_id = auth.uid());

---------------------------------------------------------------------------
-- reports, bans, admin_access_log: no client access. Admin reads go through
-- logging RPCs (admin_get_report etc.) so every access is recorded.
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- admins: a user may check whether they themselves are an admin.
---------------------------------------------------------------------------
grant select on public.admins to authenticated;

create policy admins_select_self on public.admins
  for select to authenticated
  using (user_id = auth.uid());

---------------------------------------------------------------------------
-- notifications: owner reads and marks as read
---------------------------------------------------------------------------
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid());

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

---------------------------------------------------------------------------
-- profile_views, events_log: written by RPCs only; no client access.
---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- app_config: non-secret settings, readable by anyone
---------------------------------------------------------------------------
grant select on public.app_config to anon, authenticated;

create policy app_config_select on public.app_config
  for select to anon, authenticated
  using (true);
