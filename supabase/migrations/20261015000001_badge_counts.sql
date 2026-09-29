-- KOL-08: the two numbers on the Likes and Chats tabs in one query.
--
-- The app used to run get_incoming_likes, get_group_invites, get_matches and
-- get_my_groups, and count their rows, on every route change and on every
-- message anyone received. The conditions below are the ones those four
-- functions apply, without the photos, ages and ordering, so the numbers are
-- the same:
--
--   likes   = likes waiting for me + group invites waiting for me
--   matches = matches that are new or have unread messages
--           + groups that are new, have unread messages, or (as admin)
--             have people asking to join
--
-- Two of the four functions raise for callers they don't serve, and the app
-- counted that as 0. This one never raises for a signed-in caller: someone
-- who can't use discovery (banned, or profile or video not done) has 0 likes.

create function public.get_badge_counts()
returns table (likes int, matches int)
language sql stable security definer set search_path = '' as $$
  select
    (
      -- get_incoming_likes: callers require_discovery_user() rejects get 0.
      case when exists (
        select 1 from public.profiles p
        where p.id = me.uid and not p.is_banned
          and coalesce(p.onboarding_complete, false)
          and p.verification_status in ('pending', 'approved')
      ) then (
        select count(*)::int
        from public.swipes s
        join public.profiles t on t.id = s.from_user
        where s.to_user = me.uid
          and s.status = 'pending'
          and private.is_active_approved(t.id)
          and not private.is_blocked_between(me.uid, t.id)
      ) else 0 end
      -- get_group_invites
      + case when private.is_active_approved(me.uid) then (
        select count(*)::int
        from public.group_members m
        join public.groups g on g.id = m.group_id
        where m.user_id = me.uid and m.status = 'invited'
          and g.status = 'open'
          and (g.event_date is null or g.event_date >= private.today_ist())
          and g.admin_id is not null and not private.is_blocked_between(me.uid, g.admin_id)
      ) else 0 end
    ),
    (
      -- get_matches: unread or is_new
      (
        select count(*)::int
        from public.matches m
        join public.conversations c on c.match_id = m.id
        join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = me.uid
        join public.profiles t on t.id = case when m.user_a = me.uid then m.user_b else m.user_a end
        where me.uid in (m.user_a, m.user_b)
          and private.is_active_approved(t.id)
          and not private.is_blocked_between(me.uid, t.id)
          and (
            (c.last_message_at is not null and c.last_message_at > coalesce(cm.last_read_at, '-infinity'))
            or exists (
              select 1 from public.notifications n
              where n.user_id = me.uid and n.type = 'match' and n.read_at is null
                and n.payload ->> 'match_id' = m.id::text
            )
          )
      )
      -- get_my_groups: unread, is_new, or pending_requests > 0
      + (
        select count(*)::int
        from public.group_members m
        join public.groups g on g.id = m.group_id
        join public.conversations c on c.group_id = g.id
        join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = me.uid
        where m.user_id = me.uid and m.status = 'approved'
          and not (select is_banned from public.profiles where id = me.uid)
          and (
            (c.last_message_at is not null and c.last_message_at > coalesce(cm.last_read_at, '-infinity'))
            or exists (
              select 1 from public.notifications n
              where n.user_id = me.uid and n.type in ('group_approved', 'group_admin') and n.read_at is null
                and n.payload ->> 'group_id' = g.id::text
            )
            or (m.role = 'admin' and exists (
              select 1 from public.group_members r
              where r.group_id = g.id and r.status = 'requested' and private.is_active_approved(r.user_id)
            ))
          )
      )
    )
  from (select private.require_uid() as uid) me;
$$;

revoke all on function public.get_badge_counts() from public;
grant execute on function public.get_badge_counts() to authenticated;
