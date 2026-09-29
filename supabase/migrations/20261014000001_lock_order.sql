-- KOL-12: block_user and report_user took the same locks in opposite orders
-- and could deadlock (SQLSTATE 40P01).
--
--   report_user  conversation row  ->  pair lock (inside apply_block)
--   block_user   pair lock         ->  conversation row (inside apply_block)
--
-- block_user also inserted its blocks row before taking the pair lock, so with
-- report_user fixed alone, the same person blocking and reporting the same
-- user still crossed on that row. Both functions now take the pair lock first,
-- before anything else they write or lock. Nothing else changes.
--
-- Lock order for everything that locks conversations, groups or pairs.
-- Outermost first; a function may skip levels but never goes back up.
--
--   1. Pair advisory lock, private.lock_pair(a, b)
--        like_profile, pass_profile, respond_to_like, block_user, report_user
--        (apply_block takes it again; advisory locks are re-entrant).
--   2. Group row, private.lock_group (groups ... for update)
--        every group RPC that changes a group, depart_groups_on_delete,
--        ban_user (once per group the banned user is in). The
--        enforce_group_capacity trigger locks the same row, already held.
--   3. Conversation row (for update, or updated)
--        send_message, report_user, apply_block, admit_member, depart_group,
--        ban_user.
--   4. Inner rows, never locked before the levels above: conversation_members,
--        messages, blocks, swipes, notifications, events_log.
--
-- send_message takes level 3 and then level 4 only, so it cannot be one half
-- of a cycle with block_user or report_user.
--
-- Separate chains that do not wait on levels 1 to 3 while holding each other:
--   profiles row: complete_onboarding, submit_verification.
--   verification_videos row, then profiles: admin verify.
--   photos row: admin_review_photo.
--   reports row, then ban_user: admin_resolve_report.
--   advisory lock 'feed:<uid>': get_feed (nothing else is taken under it).
--
-- Known and not changed here:
--   - ban_user updates all of the banned user's direct conversations in one
--     statement without the pair lock. It could in principle cross with
--     apply_block on a pair that matched in two activities (two direct chats),
--     if an admin ban and a block or report on that pair land at the same moment.
--   - depart_group, when the last member leaves and the group closes, updates
--     the conversation row after their conversation_members row, and
--     send_message goes the other way round. That needs the last remaining
--     member to send a message and leave at the same instant.

create or replace function public.block_user(p_target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  if p_target_id = uid then
    raise exception 'You can''t block yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'This profile is no longer available' using errcode = '22023';
  end if;

  -- First, ahead of the blocks row and the conversation update (KOL-12).
  perform private.lock_pair(uid, p_target_id);

  insert into public.blocks (blocker_id, blocked_id) values (uid, p_target_id)
  on conflict do nothing;
  perform private.apply_block(uid, p_target_id);
end;
$$;

create or replace function public.report_user(
  p_reported_id uuid,
  p_conversation_id uuid,
  p_reason public.report_reason,
  p_details text,
  p_consent boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  details text := nullif(btrim(coalesce(p_details, '')), '');
  snap jsonb;
  ids jsonb;
  rid uuid;
begin
  if not coalesce(p_consent, false) then
    raise exception 'Please agree to share this conversation with our safety team' using errcode = '22023';
  end if;
  if p_reason is null then
    raise exception 'Please choose a reason' using errcode = '22023';
  end if;
  if char_length(details) > 2000 then
    raise exception 'Please keep the details under 2000 characters' using errcode = '22023';
  end if;
  if p_reported_id = uid then
    raise exception 'You can''t report yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_reported_id) then
    raise exception 'This profile is no longer available' using errcode = '22023';
  end if;

  -- First, ahead of the conversation lock below (KOL-12).
  perform private.lock_pair(uid, p_reported_id);

  if p_conversation_id is not null then
    -- Lock so the snapshot is exactly what's in the chat right now.
    perform 1 from public.conversations where id = p_conversation_id for update;
    if (select count(*) from public.conversation_members
        where conversation_id = p_conversation_id and user_id in (uid, p_reported_id)) < 2 then
      raise exception 'You can only report a chat you''re both in' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1 from public.reports
    where reporter_id = uid and reported_id = p_reported_id and status <> 'resolved'
      and conversation_id is not distinct from p_conversation_id
  ) then
    raise exception 'You''ve already reported this. Our safety team is looking into it.' using errcode = '22023';
  end if;

  snap := jsonb_build_object(
    'captured_at', now(),
    'reporter', (select jsonb_build_object('user_id', id, 'first_name', first_name, 'public_code', public_code)
                 from public.profiles where id = uid),
    'reported', (select jsonb_build_object(
                   'user_id', id, 'first_name', first_name, 'public_code', public_code,
                   'gender', gender, 'dob', dob, 'bio', bio)
                 from public.profiles where id = p_reported_id)
  );
  if p_conversation_id is not null then
    snap := snap || jsonb_build_object('conversation', jsonb_build_object(
      'id', p_conversation_id,
      'kind', (select kind from public.conversations where id = p_conversation_id),
      'members', (
        select jsonb_agg(jsonb_build_object('user_id', p.id, 'first_name', p.first_name, 'public_code', p.public_code))
        from public.conversation_members cm join public.profiles p on p.id = cm.user_id
        where cm.conversation_id = p_conversation_id),
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
            'id', m.id, 'sender_id', m.sender_id, 'body', m.body, 'created_at', m.created_at)
          order by m.created_at, m.id)
        from public.messages m where m.conversation_id = p_conversation_id), '[]'::jsonb)
    ));
    update public.conversations set retained = true where id = p_conversation_id;
  end if;

  select jsonb_build_object('email', lower(btrim(email)), 'phone', phone, 'socials', socials)
  into ids
  from public.profile_private where user_id = p_reported_id;

  insert into public.reports
    (reporter_id, reported_id, conversation_id, reason, details, chat_share_consent, snapshot, reported_identifiers)
  values
    (uid, p_reported_id, p_conversation_id, p_reason, details, true, snap, coalesce(ids, '{}'::jsonb))
  returning id into rid;

  insert into public.blocks (blocker_id, blocked_id) values (uid, p_reported_id)
  on conflict do nothing;
  perform private.apply_block(uid, p_reported_id);

  return rid;
end;
$$;
