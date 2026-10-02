-- Chats never stop. They keep a rolling history instead (replaces the hard
-- cap in PLAN.md §2.3).
--
-- Before: a chat had 50 × members messages, then the input was replaced by
-- "continue on socials". Now people can keep messaging, and the chat keeps
-- only its newest message_cap messages: older ones are deleted as new ones
-- arrive. Anyone in the chat can star a message to keep it; every star uses
-- one place, so with 1 starred message a 1:1 chat keeps that one plus the
-- newest 99. At most half the places can be starred, so there is always room
-- for new messages.
--
-- message_cap keeps its meaning (50 × members, only ever grows) as the size
-- of the history. message_count is now every message ever sent, so it may
-- pass the cap. A reported (retained) chat is never pruned, as before: it is
-- exempt from every cleanup. get_messages shows it with the same window.
--
-- Lock order (20261014000001): star_message, like send_message, takes the
-- conversation row (level 3) and then messages (level 4).

alter table public.messages
  add column starred_at timestamptz,
  add column starred_by uuid references public.profiles (id) on delete set null,
  add constraint messages_starred_check check (starred_at is not null or starred_by is null);

create index messages_unstarred_idx on public.messages (conversation_id, created_at desc)
  where starred_at is null;

alter table public.conversations
  drop constraint conversations_check1,
  add column starred_count int not null default 0,
  add constraint conversations_message_count_check check (message_count >= 0),
  add constraint conversations_starred_count_check check (starred_count between 0 and message_cap / 2);

---------------------------------------------------------------------------
-- The window
---------------------------------------------------------------------------
-- Deletes unstarred messages older than the newest (cap - starred) ones.
-- The caller holds the conversation row lock.
create function private.prune_messages(conv uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
begin
  select * into c from public.conversations where id = conv;
  if c.retained then
    return;
  end if;
  delete from public.messages m
  where m.conversation_id = c.id
    and m.starred_at is null
    and m.id not in (
      select k.id from public.messages k
      where k.conversation_id = c.id and k.starred_at is null
      order by k.created_at desc, k.id desc
      limit c.message_cap - c.starred_count
    );
end;
$$;

---------------------------------------------------------------------------
-- Send: no more KL002
---------------------------------------------------------------------------
-- Same as 20261001000001, minus the cap check and the 80%/95% reminders,
-- plus pruning. chat_cap_reached is still logged once, when the history
-- first fills up. Returns {message}.
create or replace function public.send_message(p_conversation_id uuid, p_body text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  body text := btrim(coalesce(p_body, ''));
  c public.conversations;
  msg public.messages;
  new_count int;
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

  -- clock_timestamp, so messages sent in one transaction still order and page.
  insert into public.messages (conversation_id, sender_id, body, created_at)
  values (c.id, uid, body, clock_timestamp())
  returning * into msg;

  new_count := c.message_count + 1;
  update public.conversations set message_count = new_count, last_message_at = msg.created_at
  where id = c.id;
  update public.conversation_members set last_read_at = msg.created_at
  where conversation_id = c.id and user_id = uid;

  perform private.prune_messages(c.id);

  if new_count = c.message_cap then
    insert into public.events_log (user_id, name, props)
    select cm.user_id, 'chat_cap_reached', jsonb_build_object('conversation_id', c.id)
    from public.conversation_members cm
    where cm.conversation_id = c.id and cm.left_at is null;
  end if;

  return jsonb_build_object(
    'message', jsonb_build_object(
      'id', msg.id, 'sender_id', msg.sender_id, 'body', msg.body,
      'created_at', msg.created_at, 'starred_at', null)
  );
end;
$$;

---------------------------------------------------------------------------
-- Star / unstar
---------------------------------------------------------------------------
-- Stars belong to the chat, not to one person: everyone sees them and anyone
-- can remove one. Nothing is deleted here: a star moves a message out of the
-- newest (cap - starred) and takes one place with it, so the next message
-- sent pushes out the oldest unstarred one. An unstarred message rejoins by
-- its time, and goes once it's the oldest. Returns {starred_count}.
create function public.star_message(p_message_id uuid, p_starred boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  conv uuid;
  c public.conversations;
  m public.messages;
begin
  select conversation_id into conv from public.messages where id = p_message_id;
  if conv is null then
    raise exception 'This message is no longer in the chat' using errcode = '22023';
  end if;

  select * into c from public.conversations where id = conv for update;
  perform private.require_member(uid, c.id);
  if c.is_frozen then
    raise exception 'This chat is closed' using errcode = '22023';
  end if;

  -- Again under the lock: a send may have just pruned it.
  select * into m from public.messages where id = p_message_id;
  if not found then
    raise exception 'This message is no longer in the chat' using errcode = '22023';
  end if;

  if coalesce(p_starred, false) and m.starred_at is null then
    if c.starred_count >= c.message_cap / 2 then
      raise exception 'You can star up to % messages in this chat. Unstar one first.', c.message_cap / 2
        using errcode = '22023';
    end if;
    update public.messages set starred_at = clock_timestamp(), starred_by = uid where id = m.id;
    update public.conversations set starred_count = starred_count + 1 where id = c.id;
  elsif not coalesce(p_starred, false) and m.starred_at is not null then
    update public.messages set starred_at = null, starred_by = null where id = m.id;
    update public.conversations set starred_count = starred_count - 1 where id = c.id;
  end if;

  return jsonb_build_object(
    'starred_count', (select starred_count from public.conversations where id = c.id)
  );
end;
$$;

---------------------------------------------------------------------------
-- Reading
---------------------------------------------------------------------------
-- Same as 20261001000001, plus starred_at, and only the messages in the
-- window (which, outside reported chats, is every stored message).
drop function public.get_messages(uuid, timestamptz, int);

create function public.get_messages(p_conversation_id uuid, p_before timestamptz default null, p_limit int default 50)
returns table (id uuid, sender_id uuid, body text, created_at timestamptz, starred_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  c public.conversations;
begin
  perform private.require_member(uid, p_conversation_id);
  select * into c from public.conversations where public.conversations.id = p_conversation_id;
  return query
    select w.id, w.sender_id, w.body, w.created_at, w.starred_at
    from (
      select m.*, row_number() over (
          partition by m.starred_at is null order by m.created_at desc, m.id desc) as newest
      from public.messages m
      where m.conversation_id = p_conversation_id
    ) w
    where (w.starred_at is not null or w.newest <= c.message_cap - c.starred_count)
      and (p_before is null or w.created_at < p_before)
      and not exists (
        select 1 from public.blocks b where b.blocker_id = uid and b.blocked_id = w.sender_id
      )
    order by w.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

-- Same as 20261002000001, plus starred_count.
create or replace function public.get_conversation(p_conversation_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  c public.conversations;
  g public.groups;
begin
  perform private.require_member(uid, p_conversation_id);
  select * into c from public.conversations where id = p_conversation_id;

  if c.kind = 'group' then
    select * into g from public.groups where id = c.group_id;
  end if;

  return jsonb_build_object(
    'id',            c.id,
    'kind',          c.kind,
    'message_cap',   c.message_cap,
    'message_count', c.message_count,
    'starred_count', c.starred_count,
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
    ), '[]'::jsonb),
    'group', case when c.kind = 'group' then jsonb_build_object(
        'id',       g.id,
        'title',    g.title,
        'is_admin', g.admin_id = uid,
        'names', coalesce((
          select jsonb_object_agg(p.id, p.first_name)
          from public.conversation_members cm
          join public.profiles p on p.id = cm.user_id
          where cm.conversation_id = c.id
        ), '{}'::jsonb)
      ) end
  );
end;
$$;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function private.prune_messages(uuid) from public;

grant execute on function
  public.star_message(uuid, boolean),
  public.get_messages(uuid, timestamptz, int)
to authenticated;
