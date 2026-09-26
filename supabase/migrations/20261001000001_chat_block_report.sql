-- Phase 3: chat, block, report, admin reports queue and bans
-- (PLAN.md §2.3, §2.4, §5.4, §5.5).
--
-- Error codes: 22023 validation, 42501 permission, KL001 banned,
-- KL002 conversation reached its message cap (the client swaps the input for
-- the socials card).

---------------------------------------------------------------------------
-- Reports keep the reported user's identifiers from the moment of the
-- report, so a ban still covers them if they delete their account first.
-- Never exposed to clients (reports has no client grants).
---------------------------------------------------------------------------
alter table public.reports add column reported_identifiers jsonb not null default '{}'::jsonb;

-- Deleting an account removes their direct chats (profile → match →
-- conversation → messages) while also nulling sender_id on those same
-- messages. Checked immediately, the null update can see its conversation
-- already gone; checking at commit lets the cascade finish first.
alter table public.messages
  alter constraint messages_conversation_id_fkey deferrable initially deferred;

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------
create function private.require_not_banned() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  if (select is_banned from public.profiles where id = uid) then
    raise exception 'Your account can''t use Kollide right now. If you think this is a mistake, contact support.'
      using errcode = 'KL001';
  end if;
  return uid;
end;
$$;

-- Active membership check shared by the chat RPCs.
create function private.require_member(uid uuid, conv uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.conversation_members
    where conversation_id = conv and user_id = uid and left_at is null
  ) then
    raise exception 'You''re not part of this chat' using errcode = '42501';
  end if;
end;
$$;

-- Links, including bare domains like "example.com" or "t.me/name".
create function private.contains_url(body text) returns boolean
language sql immutable set search_path = '' as $$
  select body ~* '(https?://|www\.|\m[a-z0-9-]+\.(com|in|net|org|io|co|me|app|link|ly|gg|xyz|info|biz|site|online|shop|store|live|tv|to|us|uk|ai|dev|page|club|click|fun|top)\M)';
$$;

-- Everything a block implies (§2.4, §5.5): freeze the pair's direct chats
-- and drop likes between them that haven't been answered.
create function private.apply_block(a uuid, b uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.lock_pair(a, b);

  update public.conversations c set is_frozen = true
  from public.matches m
  where c.match_id = m.id and m.user_a = least(a, b) and m.user_b = greatest(a, b);

  update public.swipes set
    status       = case status when 'held' then 'discarded' else 'rejected' end::public.swipe_status,
    responded_at = now()
  where ((from_user = a and to_user = b) or (from_user = b and to_user = a))
    and status in ('held', 'pending');
end;
$$;

---------------------------------------------------------------------------
-- Chat
---------------------------------------------------------------------------
-- Header data for /chat/:id. Other members are listed only while they are
-- active, approved and not blocked either way; a direct chat with a block
-- reads as frozen with nobody in it.
create function public.get_conversation(p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  c public.conversations;
begin
  perform private.require_member(uid, p_conversation_id);
  select * into c from public.conversations where id = p_conversation_id;

  return jsonb_build_object(
    'id',            c.id,
    'kind',          c.kind,
    'message_cap',   c.message_cap,
    'message_count', c.message_count,
    'is_frozen',     c.is_frozen,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
          'user_id',     p.id,
          'first_name',  p.first_name,
          'public_code', p.public_code,
          'photo_path',  (select ph.storage_path from public.photos ph
                          where ph.user_id = p.id order by ph.position limit 1)
        ) order by cm.joined_at)
      from public.conversation_members cm
      join public.profiles p on p.id = cm.user_id
      where cm.conversation_id = c.id
        and cm.user_id <> uid
        and cm.left_at is null
        and private.is_active_approved(p.id)
        and not private.is_blocked_between(uid, p.id)
    ), '[]'::jsonb)
  );
end;
$$;

-- Newest first; pass the oldest created_at you have as p_before for more.
-- Messages from people the caller blocked are hidden (group chats, §2.4).
create function public.get_messages(p_conversation_id uuid, p_before timestamptz default null, p_limit int default 50)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
begin
  perform private.require_member(uid, p_conversation_id);
  return query
    select m.id, m.sender_id, m.body, m.created_at
    from public.messages m
    where m.conversation_id = p_conversation_id
      and (p_before is null or m.created_at < p_before)
      and not exists (
        select 1 from public.blocks b where b.blocker_id = uid and b.blocked_id = m.sender_id
      )
    order by m.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- The only way to write a message (§5.4). The conversation row lock
-- serializes senders, so message_count can never pass message_cap.
-- Returns {message, remaining}.
create function public.send_message(p_conversation_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  body text := btrim(coalesce(p_body, ''));
  c public.conversations;
  msg public.messages;
  new_count int;
  pct int;
begin
  select * into c from public.conversations where id = p_conversation_id for update;
  perform private.require_member(uid, p_conversation_id);

  if c.is_frozen or (
    c.kind = 'direct' and exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = c.id and cm.user_id <> uid
        and (private.is_blocked_between(uid, cm.user_id) or not private.is_active_approved(cm.user_id))
    )
  ) then
    raise exception 'This chat is closed' using errcode = '22023';
  end if;
  if char_length(body) not between 1 and 500 then
    raise exception 'Messages can be 1 to 500 characters' using errcode = '22023';
  end if;
  if private.contains_url(body) then
    raise exception 'Links aren''t allowed in chat' using errcode = '22023';
  end if;
  if c.message_count >= c.message_cap then
    raise exception 'This chat has used all its messages. Continue on socials!' using errcode = 'KL002';
  end if;

  -- clock_timestamp, so messages sent in one transaction still order and page.
  insert into public.messages (conversation_id, sender_id, body, created_at)
  values (c.id, uid, body, clock_timestamp())
  returning * into msg;

  new_count := c.message_count + 1;
  update public.conversations set message_count = new_count, last_message_at = msg.created_at
  where id = c.id;
  update public.conversation_members set last_read_at = msg.created_at
  where conversation_id = c.id and user_id = uid;

  -- Reminders the first time the count crosses 80% and 95% of the cap.
  foreach pct in array array[80, 95] loop
    if c.message_count * 100 < pct * c.message_cap and new_count * 100 >= pct * c.message_cap then
      insert into public.notifications (user_id, type, payload)
      select cm.user_id, 'chat_cap_warning', jsonb_build_object(
        'conversation_id', c.id, 'percent', pct, 'remaining', c.message_cap - new_count)
      from public.conversation_members cm
      where cm.conversation_id = c.id and cm.left_at is null;
    end if;
  end loop;

  if new_count = c.message_cap then
    insert into public.events_log (user_id, name, props)
    select cm.user_id, 'chat_cap_reached', jsonb_build_object('conversation_id', c.id)
    from public.conversation_members cm
    where cm.conversation_id = c.id and cm.left_at is null;
  end if;

  return jsonb_build_object(
    'message', jsonb_build_object(
      'id', msg.id, 'sender_id', msg.sender_id, 'body', msg.body, 'created_at', msg.created_at),
    'remaining', c.message_cap - new_count
  );
end;
$$;

-- Server clock (same one messages use), so unread flags don't depend on the phone's time.
create function public.mark_conversation_read(p_conversation_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.conversation_members set last_read_at = clock_timestamp()
  where conversation_id = p_conversation_id and user_id = auth.uid() and left_at is null;
$$;

---------------------------------------------------------------------------
-- Block and report
---------------------------------------------------------------------------
create function public.block_user(p_target_id uuid) returns void
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

  insert into public.blocks (blocker_id, blocked_id) values (uid, p_target_id)
  on conflict do nothing;
  perform private.apply_block(uid, p_target_id);
end;
$$;

-- Report someone, optionally about a chat you share (§2.4). Snapshots the
-- whole conversation, marks it retained, and blocks the reported user.
-- Returns the report id.
create function public.report_user(
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

---------------------------------------------------------------------------
-- Admin: reports queue, logged report access, resolution and bans
---------------------------------------------------------------------------
create function public.admin_reports_queue()
returns table (
  report_id      uuid,
  reason         public.report_reason,
  status         public.report_status,
  created_at     timestamptz,
  reporter_name  text,
  reporter_code  text,
  reported_id    uuid,
  reported_name  text,
  reported_code  text,
  reported_banned boolean,
  message_count  int,
  reports_against int
)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return query
    select
      r.id,
      r.reason,
      r.status,
      r.created_at,
      r.snapshot #>> '{reporter,first_name}',
      r.snapshot #>> '{reporter,public_code}',
      r.reported_id,
      r.snapshot #>> '{reported,first_name}',
      r.snapshot #>> '{reported,public_code}',
      coalesce((select p.is_banned from public.profiles p where p.id = r.reported_id), false),
      coalesce(jsonb_array_length(r.snapshot #> '{conversation,messages}'), 0),
      (select count(*)::int from public.reports o where o.reported_id = r.reported_id)
    from public.reports r
    where r.status <> 'resolved'
    order by r.created_at;
end;
$$;

-- Every open is logged before anything is returned (§5.5).
create function public.admin_get_report(p_report_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := private.require_admin();
  r public.reports;
begin
  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = '22023';
  end if;

  insert into public.admin_access_log (admin_id, action, target_type, target_id)
  values (admin_uid, 'view_report', 'report', r.id);

  if r.status = 'open' then
    update public.reports set status = 'reviewing' where id = r.id;
    r.status := 'reviewing';
  end if;

  return jsonb_build_object(
    'id',              r.id,
    'reporter_id',     r.reporter_id,
    'reported_id',     r.reported_id,
    'conversation_id', r.conversation_id,
    'reason',          r.reason,
    'details',         r.details,
    'status',          r.status,
    'resolution',      r.resolution,
    'resolved_at',     r.resolved_at,
    'created_at',      r.created_at,
    'snapshot',        r.snapshot,
    'reported_banned', coalesce((select is_banned from public.profiles where id = r.reported_id), false),
    'reported_deleted', not exists (select 1 from public.profiles where id = r.reported_id),
    -- Which identifier kinds a ban would cover (not the values).
    'ban_covers', (
      select coalesce(jsonb_agg(distinct k), '[]'::jsonb) from (
        select 'email' as k where coalesce(r.reported_identifiers ->> 'email', '') <> ''
        union select 'phone' where coalesce(r.reported_identifiers ->> 'phone', '') <> ''
        union select jsonb_object_keys(coalesce(r.reported_identifiers -> 'socials', '{}'::jsonb))
      ) kinds
    ),
    'other_reports', (
      select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'reason', o.reason, 'status', o.status,
                                                   'resolution', o.resolution, 'created_at', o.created_at)
                                order by o.created_at desc), '[]'::jsonb)
      from public.reports o where o.reported_id = r.reported_id and o.id <> r.id
    )
  );
end;
$$;

-- Bans every normalized identifier the user had at report time or has now,
-- then takes them out of every conversation (§2.4, §5.5).
create function private.ban_user(uid uuid, report uuid, ids jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pp public.profile_private;
begin
  select * into pp from public.profile_private where user_id = uid;

  insert into public.bans (kind, value_normalized, report_id)
  select distinct v.kind::public.ban_kind, v.value, report
  from (
    select 'email' as kind, lower(btrim(ids ->> 'email')) as value
    union all select 'email', lower(btrim(pp.email))
    union all select 'phone', ids ->> 'phone'
    union all select 'phone', pp.phone
    union all select s.key, s.value from jsonb_each_text(coalesce(ids -> 'socials', '{}'::jsonb)) s
    union all select s.key, s.value from jsonb_each_text(coalesce(pp.socials, '{}'::jsonb)) s
  ) v
  where coalesce(v.value, '') <> ''
    and v.kind in ('email', 'phone', 'instagram', 'snapchat', 'whatsapp', 'telegram')
  on conflict (kind, value_normalized) do nothing;

  update public.profiles set is_banned = true where id = uid;

  -- Direct chats freeze for both people. In group chats only the banned
  -- user leaves, so the rest of the group can keep talking.
  update public.conversations c set is_frozen = true
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = uid);
  update public.conversation_members cm set left_at = now()
  from public.conversations c
  where c.id = cm.conversation_id and c.kind = 'group' and cm.user_id = uid and cm.left_at is null;

  -- Their unanswered likes go nowhere.
  update public.swipes set status = 'discarded'
  where from_user = uid and status in ('held', 'pending');
end;
$$;

create function public.admin_resolve_report(p_report_id uuid, p_resolution public.report_resolution) returns void
language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := private.require_admin();
  r public.reports;
begin
  if p_resolution is null then
    raise exception 'Please choose a resolution' using errcode = '22023';
  end if;

  select * into r from public.reports where id = p_report_id for update;
  if not found then
    raise exception 'Report not found' using errcode = '22023';
  end if;
  if r.status = 'resolved' then
    raise exception 'This report is already resolved' using errcode = '22023';
  end if;
  if admin_uid in (r.reporter_id, r.reported_id) then
    raise exception 'You can''t resolve a report you''re part of' using errcode = '42501';
  end if;

  if p_resolution = 'ban' then
    perform private.ban_user(r.reported_id, r.id, r.reported_identifiers);
  end if;

  update public.reports set
    status      = 'resolved',
    resolution  = p_resolution,
    resolved_by = admin_uid,
    resolved_at = now()
  where id = r.id;

  insert into public.admin_access_log (admin_id, action, target_type, target_id)
  values (admin_uid, 'resolve_report', 'report', r.id);
end;
$$;

---------------------------------------------------------------------------
-- Realtime: chat screens listen for new messages and conversation changes
-- (count, frozen). RLS on both tables limits events to active members.
---------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.conversations;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.require_not_banned(),
  private.require_member(uuid, uuid),
  private.contains_url(text),
  private.apply_block(uuid, uuid),
  private.ban_user(uuid, uuid, jsonb)
from public;

grant execute on function
  public.get_conversation(uuid),
  public.get_messages(uuid, timestamptz, int),
  public.send_message(uuid, text),
  public.mark_conversation_read(uuid),
  public.block_user(uuid),
  public.report_user(uuid, uuid, public.report_reason, text, boolean),
  public.admin_reports_queue(),
  public.admin_get_report(uuid),
  public.admin_resolve_report(uuid, public.report_resolution)
to authenticated;
