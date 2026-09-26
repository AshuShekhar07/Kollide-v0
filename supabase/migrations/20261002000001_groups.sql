-- Phase 4: groups (PLAN.md §2.1 group matching, §5.3).
--
-- Membership states (group_members.status):
--   requested  asked to join; waiting on the group admin
--   invited    invited by the admin; waiting on the invitee
--   approved   in the group and its chat
--   rejected   request declined by the admin; can't ask again
--   left       left on their own; may ask again
--   removed    removed by the admin (or banned); can't ask again
-- A cancelled request, declined invite or withdrawn invite deletes the row.
--
-- Every membership change locks the group row first, so approvals are
-- serialized per group; a trigger backs up the max_members limit.
-- Error codes: 22023 validation, 42501 permission, KL001 banned.

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------
-- Groups are for verified people only (§2.1 group requirements).
create function private.require_approved() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
begin
  if not private.is_active_approved(uid) then
    raise exception 'Groups open up once you''re verified. We''ll let you know when you are.'
      using errcode = '22023';
  end if;
  return uid;
end;
$$;

create function private.lock_group(gid uuid) returns public.groups
language plpgsql security definer set search_path = '' as $$
declare
  g public.groups;
begin
  select * into g from public.groups where id = gid for update;
  if not found then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  return g;
end;
$$;

create function private.require_group_admin(gid uuid, uid uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.group_members
    where group_id = gid and user_id = uid and role = 'admin' and status = 'approved'
  ) then
    raise exception 'Only the group admin can do that' using errcode = '42501';
  end if;
end;
$$;

create function private.group_member_count(gid uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.group_members where group_id = gid and status = 'approved';
$$;

-- Today in India, where the pilot runs; event dates are local dates.
create function private.today_ist() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- Can `uid` see this group at all? Members always can; others only while it
-- isn't closed and they haven't blocked (or been blocked by) the admin.
create function private.can_see_group(g public.groups, uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.group_members m
      where m.group_id = g.id and m.user_id = uid and m.status in ('approved', 'requested', 'invited')
    )
    or (g.status <> 'closed' and (g.admin_id is null or not private.is_blocked_between(uid, g.admin_id)));
$$;

-- Moves an existing requested/invited row to approved and into the chat
-- (§5.3 approve path). The caller holds the group lock.
create function private.admit_member(g public.groups, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  n int := private.group_member_count(g.id);
begin
  if g.status = 'closed' then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  if g.status = 'full' or n >= g.max_members then
    raise exception 'This group is full' using errcode = '22023';
  end if;

  update public.group_members set status = 'approved', role = 'member', approved_at = now()
  where group_id = g.id and user_id = p_user;

  insert into public.conversation_members (conversation_id, user_id)
  select c.id, p_user from public.conversations c where c.group_id = g.id
  on conflict (conversation_id, user_id) do update set left_at = null, joined_at = now();

  -- The shared pool only ever grows (§2.3).
  update public.conversations set message_cap = greatest(message_cap, 50 * (n + 1))
  where group_id = g.id;

  if n + 1 >= g.max_members then
    update public.groups set status = 'full' where id = g.id;
  end if;

  insert into public.events_log (user_id, name, props)
  values (p_user, 'group_joined', jsonb_build_object('group_id', g.id));
end;
$$;

-- Takes an approved member out of the group and its chat. If they were the
-- admin, the longest-standing member takes over; if nobody is left, the
-- group closes (§2.1). Never lowers the cap. The caller holds the group lock.
create function private.depart_group(g public.groups, p_user uuid, p_status public.group_member_status) returns void
language plpgsql security definer set search_path = '' as $$
declare
  was_admin boolean;
  heir uuid;
begin
  select m.role = 'admin' into was_admin
  from public.group_members m
  where m.group_id = g.id and m.user_id = p_user and m.status = 'approved';
  if not found then
    raise exception 'They''re not in this group' using errcode = '22023';
  end if;

  update public.group_members set status = p_status, role = 'member'
  where group_id = g.id and user_id = p_user;

  update public.conversation_members cm set left_at = now()
  from public.conversations c
  where c.group_id = g.id and cm.conversation_id = c.id and cm.user_id = p_user and cm.left_at is null;

  if was_admin then
    select m.user_id into heir
    from public.group_members m
    where m.group_id = g.id and m.status = 'approved'
    order by m.approved_at, m.created_at, m.user_id
    limit 1;

    if heir is null then
      update public.groups set status = 'closed', admin_id = null where id = g.id;
      update public.conversations set is_frozen = true where group_id = g.id;
      delete from public.group_members where group_id = g.id and status in ('requested', 'invited');
      return;
    end if;

    update public.group_members set role = 'admin' where group_id = g.id and user_id = heir;
    update public.groups set admin_id = heir where id = g.id;
    insert into public.notifications (user_id, type, payload)
    values (heir, 'group_admin', jsonb_build_object('group_id', g.id, 'title', g.title));
  end if;

  if g.status = 'full' then
    update public.groups set status = 'open' where id = g.id;
  end if;
end;
$$;

-- Backstop for the member limit, whatever path writes the row.
create function private.enforce_group_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cap int;
begin
  if tg_op = 'UPDATE' and old.status = 'approved' then
    return new;
  end if;
  select max_members into cap from public.groups where id = new.group_id for update;
  if (select count(*) from public.group_members
      where group_id = new.group_id and status = 'approved' and user_id <> new.user_id) >= cap then
    raise exception 'This group is full' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger group_members_capacity
  before insert or update of status on public.group_members
  for each row when (new.status = 'approved')
  execute function private.enforce_group_capacity();

-- Deleting an account hands their groups on before the rows cascade away.
create function private.depart_groups_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
begin
  for gid in
    select group_id from public.group_members where user_id = old.id and status = 'approved'
  loop
    perform private.depart_group(private.lock_group(gid), old.id, 'left');
  end loop;
  return old;
end;
$$;

create trigger profiles_depart_groups
  before delete on public.profiles
  for each row execute function private.depart_groups_on_delete();

---------------------------------------------------------------------------
-- Browse and details
---------------------------------------------------------------------------
-- Upcoming open groups for an activity, plus any the caller is already part
-- of or has asked to join. Hides groups run by someone either side blocked.
create function public.get_groups(p_activity_id uuid)
returns table (
  id           uuid,
  title        text,
  description  text,
  event_date   date,
  venue        text,
  max_members  int,
  member_count int,
  status       public.group_status,
  admin_name   text,
  my_status    public.group_member_status,
  created_at   timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
begin
  if not exists (select 1 from public.activities a where a.id = p_activity_id and a.status = 'live') then
    raise exception 'This activity isn''t live yet' using errcode = '22023';
  end if;

  return query
    select g.id, g.title, g.description, g.event_date, g.venue, g.max_members,
           private.group_member_count(g.id), g.status, p.first_name, m.status, g.created_at
    from public.groups g
    left join public.profiles p on p.id = g.admin_id
    left join public.group_members m on m.group_id = g.id and m.user_id = uid
    where g.activity_id = p_activity_id
      and g.status <> 'closed'
      and (g.event_date is null or g.event_date >= private.today_ist())
      and (g.status = 'open' or m.status in ('approved', 'requested', 'invited'))
      and private.can_see_group(g, uid)
    order by (m.status = 'approved') desc nulls last, g.event_date nulls last, g.created_at desc;
end;
$$;

-- Details for /groups/:id. Members show first name and public code; photos
-- and the chat only once the caller is in the group (§6.1).
create function public.get_group(p_group_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups;
  mine public.group_members;
  in_group boolean;
begin
  select * into g from public.groups where id = p_group_id;
  if not found or not private.can_see_group(g, uid) then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  select * into mine from public.group_members where group_id = g.id and user_id = uid;
  in_group := coalesce(mine.status = 'approved', false);

  return jsonb_build_object(
    'id',           g.id,
    'activity_id',  g.activity_id,
    'title',        g.title,
    'description',  g.description,
    'event_date',   g.event_date,
    'venue',        g.venue,
    'max_members',  g.max_members,
    'status',       g.status,
    'member_count', private.group_member_count(g.id),
    'my_status',    mine.status,
    'my_role',      case when in_group then mine.role end,
    'conversation_id', case when in_group then (select c.id from public.conversations c where c.group_id = g.id) end,
    'pending_requests', case when in_group and mine.role = 'admin' then (
        select count(*) from public.group_members r
        where r.group_id = g.id and r.status = 'requested' and private.is_active_approved(r.user_id)
      ) end,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
          'user_id',     p.id,
          'first_name',  p.first_name,
          'public_code', p.public_code,
          'role',        m.role,
          'photo_path',  case when in_group then (
                           select ph.storage_path from public.photos ph
                           where ph.user_id = p.id order by ph.position limit 1) end
        ) order by m.role = 'admin' desc, m.approved_at)
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      where m.group_id = g.id and m.status = 'approved'
        and (p.id = uid or (private.is_active_approved(p.id) and not private.is_blocked_between(uid, p.id)))
    ), '[]'::jsonb)
  );
end;
$$;

-- Approved groups the caller is in, for /matches.
create function public.get_my_groups()
returns table (
  group_id         uuid,
  conversation_id  uuid,
  title            text,
  event_date       date,
  role             public.group_role,
  member_count     int,
  max_members      int,
  last_message_at  timestamptz,
  unread           boolean,
  pending_requests int,
  is_new           boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  return query
    select
      g.id,
      c.id,
      g.title,
      g.event_date,
      m.role,
      private.group_member_count(g.id),
      g.max_members,
      c.last_message_at,
      c.last_message_at is not null and c.last_message_at > coalesce(cm.last_read_at, '-infinity'),
      case when m.role = 'admin' then (
        select count(*)::int from public.group_members r
        where r.group_id = g.id and r.status = 'requested' and private.is_active_approved(r.user_id)
      ) else 0 end,
      exists (
        select 1 from public.notifications n
        where n.user_id = uid and n.type in ('group_approved', 'group_admin') and n.read_at is null
          and n.payload ->> 'group_id' = g.id::text
      )
    from public.group_members m
    join public.groups g on g.id = m.group_id
    join public.conversations c on c.group_id = g.id
    join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = uid
    where m.user_id = uid and m.status = 'approved'
      and not (select is_banned from public.profiles where id = uid)
    order by coalesce(c.last_message_at, m.approved_at) desc;
end;
$$;

-- Open invitations for the caller, for /likes.
create function public.get_group_invites()
returns table (
  group_id     uuid,
  title        text,
  description  text,
  event_date   date,
  venue        text,
  member_count int,
  max_members  int,
  admin_name   text,
  invited_at   timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  if not private.is_active_approved(uid) then
    return;
  end if;
  return query
    select g.id, g.title, g.description, g.event_date, g.venue,
           private.group_member_count(g.id), g.max_members, p.first_name, m.created_at
    from public.group_members m
    join public.groups g on g.id = m.group_id
    left join public.profiles p on p.id = g.admin_id
    where m.user_id = uid and m.status = 'invited'
      and g.status = 'open'
      and (g.event_date is null or g.event_date >= private.today_ist())
      and g.admin_id is not null and not private.is_blocked_between(uid, g.admin_id)
    order by m.created_at desc;
end;
$$;

---------------------------------------------------------------------------
-- Create, request, invite, respond
---------------------------------------------------------------------------
-- Returns {group_id, conversation_id}.
create function public.create_group(
  p_activity_id uuid,
  p_title       text,
  p_description text,
  p_event_date  date,
  p_venue       text,
  p_max_members int
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  title text := btrim(coalesce(p_title, ''));
  description text := nullif(btrim(coalesce(p_description, '')), '');
  venue text := nullif(btrim(coalesce(p_venue, '')), '');
  gid uuid;
  cid uuid;
begin
  perform private.require_live_activity(uid, p_activity_id);
  if char_length(title) not between 1 and 80 then
    raise exception 'Give your group a name (up to 80 characters)' using errcode = '22023';
  end if;
  if char_length(description) > 1000 then
    raise exception 'Please keep the description under 1000 characters' using errcode = '22023';
  end if;
  if char_length(venue) > 200 then
    raise exception 'Please keep the venue under 200 characters' using errcode = '22023';
  end if;
  if p_event_date is not null and p_event_date < private.today_ist() then
    raise exception 'Pick a date that hasn''t passed' using errcode = '22023';
  end if;
  if p_max_members is null or p_max_members not between 2 and 10 then
    raise exception 'Groups can have 2 to 10 people' using errcode = '22023';
  end if;
  if private.contains_url(coalesce(description, '') || ' ' || title || ' ' || coalesce(venue, '')) then
    raise exception 'Links aren''t allowed in groups' using errcode = '22023';
  end if;
  -- Keeps one person from flooding the list.
  if (select count(*) from public.group_members m join public.groups g on g.id = m.group_id
      where m.user_id = uid and m.role = 'admin' and m.status = 'approved' and g.status <> 'closed') >= 3 then
    raise exception 'You can run up to 3 groups at a time' using errcode = '22023';
  end if;

  insert into public.groups (admin_id, activity_id, title, description, event_date, venue, max_members)
  values (uid, p_activity_id, title, description, p_event_date, venue, p_max_members)
  returning id into gid;

  insert into public.group_members (group_id, user_id, role, status, approved_at)
  values (gid, uid, 'admin', 'approved', now());

  insert into public.conversations (kind, group_id, message_cap)
  values ('group', gid, 50)
  returning id into cid;
  insert into public.conversation_members (conversation_id, user_id) values (cid, uid);

  insert into public.events_log (user_id, name, props)
  values (uid, 'group_created', jsonb_build_object('group_id', gid));

  return jsonb_build_object('group_id', gid, 'conversation_id', cid);
end;
$$;

-- Ask to join (§5.3). If the admin already invited the caller, this joins
-- straight away. Returns the caller's new status.
create function public.request_join(p_group_id uuid) returns public.group_member_status
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
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

  insert into public.group_members (group_id, user_id, status)
  values (g.id, uid, 'requested')
  on conflict (group_id, user_id) do update set status = 'requested', created_at = now(), approved_at = null;

  insert into public.notifications (user_id, type, payload)
  values (g.admin_id, 'group_join_request', jsonb_build_object('group_id', g.id, 'user_id', uid));
  return 'requested';
end;
$$;

-- Withdraw your own pending request.
create function public.cancel_join_request(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  g public.groups := private.lock_group(p_group_id);
begin
  delete from public.group_members where group_id = g.id and user_id = uid and status = 'requested';
  if not found then
    raise exception 'You don''t have a request for this group' using errcode = '22023';
  end if;
end;
$$;

create function public.invite_to_group(p_group_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
  cur public.group_member_status;
begin
  perform private.require_group_admin(g.id, uid);
  if p_user_id = uid then
    raise exception 'You''re already in this group' using errcode = '22023';
  end if;
  if not private.is_active_approved(p_user_id) or private.is_blocked_between(uid, p_user_id) then
    raise exception 'You can only invite verified people' using errcode = '22023';
  end if;
  if g.status <> 'open' or private.group_member_count(g.id) >= g.max_members then
    raise exception 'This group is full' using errcode = '22023';
  end if;

  select status into cur from public.group_members where group_id = g.id and user_id = p_user_id;
  if cur = 'approved' then
    raise exception 'They''re already in this group' using errcode = '22023';
  elsif cur = 'invited' then
    raise exception 'You''ve already invited them' using errcode = '22023';
  elsif cur = 'requested' then
    raise exception 'They''ve asked to join. Approve their request instead.' using errcode = '22023';
  end if;

  insert into public.group_members (group_id, user_id, status)
  values (g.id, p_user_id, 'invited')
  on conflict (group_id, user_id) do update set status = 'invited', created_at = now(), approved_at = null;

  insert into public.notifications (user_id, type, payload)
  values (p_user_id, 'group_invite', jsonb_build_object('group_id', g.id, 'title', g.title));
end;
$$;

create function public.respond_join_request(p_group_id uuid, p_user_id uuid, p_approve boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
begin
  perform private.require_group_admin(g.id, uid);
  if not exists (
    select 1 from public.group_members where group_id = g.id and user_id = p_user_id and status = 'requested'
  ) then
    raise exception 'This request is no longer pending' using errcode = '22023';
  end if;

  if not coalesce(p_approve, false) then
    update public.group_members set status = 'rejected' where group_id = g.id and user_id = p_user_id;
    return;
  end if;

  if not private.is_active_approved(p_user_id) or private.is_blocked_between(uid, p_user_id) then
    update public.group_members set status = 'rejected' where group_id = g.id and user_id = p_user_id;
    raise exception 'This person can''t join right now' using errcode = '22023';
  end if;

  perform private.admit_member(g, p_user_id);
  insert into public.notifications (user_id, type, payload)
  values (p_user_id, 'group_approved', jsonb_build_object('group_id', g.id, 'title', g.title));
end;
$$;

create function public.respond_invite(p_group_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
begin
  if not exists (
    select 1 from public.group_members where group_id = g.id and user_id = uid and status = 'invited'
  ) then
    raise exception 'This invite is no longer open' using errcode = '22023';
  end if;

  if not coalesce(p_accept, false) then
    delete from public.group_members where group_id = g.id and user_id = uid;
    return;
  end if;

  if g.admin_id is null or private.is_blocked_between(uid, g.admin_id) then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  perform private.admit_member(g, uid);
  insert into public.notifications (user_id, type, payload)
  values (g.admin_id, 'group_invite_accepted', jsonb_build_object('group_id', g.id, 'user_id', uid));
end;
$$;

---------------------------------------------------------------------------
-- Leave and remove
---------------------------------------------------------------------------
create function public.leave_group(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  g public.groups := private.lock_group(p_group_id);
begin
  if not exists (select 1 from public.group_members where group_id = g.id and user_id = uid and status = 'approved') then
    raise exception 'You''re not in this group' using errcode = '22023';
  end if;
  perform private.depart_group(g, uid, 'left');
end;
$$;

-- Removes a member, or withdraws an invite that hasn't been answered.
create function public.remove_member(p_group_id uuid, p_user_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
  cur public.group_member_status;
begin
  perform private.require_group_admin(g.id, uid);
  if p_user_id = uid then
    raise exception 'To step away from your own group, leave it instead' using errcode = '22023';
  end if;

  select status into cur from public.group_members where group_id = g.id and user_id = p_user_id;
  if cur = 'invited' then
    delete from public.group_members where group_id = g.id and user_id = p_user_id;
  elsif cur = 'approved' then
    perform private.depart_group(g, p_user_id, 'removed');
  else
    raise exception 'They''re not in this group' using errcode = '22023';
  end if;
end;
$$;

---------------------------------------------------------------------------
-- Management: requests plus people to invite (§5.3)
---------------------------------------------------------------------------
-- Pending requests and invites first, then up to 50 verified people who
-- picked this group's activity and could be invited (people looking for a
-- group first).
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
  since       timestamptz
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
      select m.user_id as id, m.status as st, m.created_at as at, 0 as bucket
      from public.group_members m
      where m.group_id = g.id and m.status in ('requested', 'invited')
      union all
      select * from (
        select ua.user_id, null::public.group_member_status, null::timestamptz, 1
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
           x.st, x.at
    from people x
    join public.profiles p on p.id = x.id
    where private.is_active_approved(p.id) and not private.is_blocked_between(uid, p.id)
    order by x.bucket, x.st, x.at, (p.seeking = 'group') desc, p.created_at desc;
end;
$$;

---------------------------------------------------------------------------
-- Chat header: group chats also carry the group, and the names of everyone
-- who has been in the chat so older messages keep their sender's name.
---------------------------------------------------------------------------
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
-- Bans also take the user out of their groups (handing admin on), and drop
-- their pending requests and invites.
---------------------------------------------------------------------------
create or replace function private.ban_user(uid uuid, report uuid, ids jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  pp public.profile_private;
  gid uuid;
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

  -- Direct chats freeze for both people. In groups only the banned user
  -- goes, so the rest of the group can keep talking.
  update public.conversations c set is_frozen = true
  where c.kind = 'direct'
    and exists (select 1 from public.conversation_members cm where cm.conversation_id = c.id and cm.user_id = uid);
  for gid in
    select group_id from public.group_members where user_id = uid and status = 'approved'
  loop
    perform private.depart_group(private.lock_group(gid), uid, 'removed');
  end loop;
  delete from public.group_members where user_id = uid and status in ('requested', 'invited');
  update public.conversation_members cm set left_at = now()
  from public.conversations c
  where c.id = cm.conversation_id and c.kind = 'group' and cm.user_id = uid and cm.left_at is null;

  -- Their unanswered likes go nowhere.
  update public.swipes set status = 'discarded'
  where from_user = uid and status in ('held', 'pending');
end;
$$;

---------------------------------------------------------------------------
-- RLS: groups run by someone either side blocked are hidden from non-members
-- (§2.4 "hidden everywhere"). All group writes go through the RPCs above.
---------------------------------------------------------------------------
drop policy groups_select on public.groups;
create policy groups_select on public.groups
  for select to authenticated
  using (
    private.is_admin()
    or exists (
      select 1 from public.group_members m
      where m.group_id = groups.id and m.user_id = auth.uid()
    )
    or (
      status <> 'closed'
      and private.is_active_approved(auth.uid())
      and (admin_id is null or not private.is_blocked_between(auth.uid(), admin_id))
    )
  );

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.require_approved(),
  private.lock_group(uuid),
  private.require_group_admin(uuid, uuid),
  private.group_member_count(uuid),
  private.today_ist(),
  private.can_see_group(public.groups, uuid),
  private.admit_member(public.groups, uuid),
  private.depart_group(public.groups, uuid, public.group_member_status),
  private.enforce_group_capacity(),
  private.depart_groups_on_delete()
from public;

grant execute on function
  public.get_groups(uuid),
  public.get_group(uuid),
  public.get_my_groups(),
  public.get_group_invites(),
  public.create_group(uuid, text, text, date, text, int),
  public.request_join(uuid),
  public.cancel_join_request(uuid),
  public.invite_to_group(uuid, uuid),
  public.respond_join_request(uuid, uuid, boolean),
  public.respond_invite(uuid, boolean),
  public.leave_group(uuid),
  public.remove_member(uuid, uuid),
  public.get_group_interested(uuid)
to authenticated;
