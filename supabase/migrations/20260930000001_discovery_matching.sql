-- Phase 2: discovery feed, likes (with held logic), matches and contact
-- reveal (PLAN.md §2.1, §2.2, §5.1 approval trigger, §5.2).
--
-- Swipe states for likes:
--   held      liker isn't verified yet; invisible to the recipient
--   pending   visible in the recipient's incoming likes
--   accepted  turned into a match (mutual like or recipient accepted)
--   rejected  recipient declined (or passed on the liker); liker isn't told
--   discarded liker was rejected at verification; dropped silently
-- Passes have no status.

---------------------------------------------------------------------------
-- Helpers
---------------------------------------------------------------------------
-- The caller's profile, if they may use discovery: onboarded, not banned,
-- and a video submitted (pending) or approved.
create function private.require_discovery_user() returns public.profiles
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = private.require_uid();
  if p.is_banned then
    raise exception 'Your account can''t use Kollide right now. If you think this is a mistake, contact support.'
      using errcode = 'KL001';
  end if;
  if not coalesce(p.onboarding_complete, false) or p.verification_status not in ('pending', 'approved') then
    raise exception 'Please finish your profile and verification video first' using errcode = '22023';
  end if;
  return p;
end;
$$;

-- The caller must have picked this activity, and it must be live.
create function private.require_live_activity(uid uuid, activity uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.user_activities ua
    join public.activities a on a.id = ua.activity_id
    where ua.user_id = uid and ua.activity_id = activity and a.status = 'live'
  ) then
    raise exception 'Add this activity to your profile to see people for it' using errcode = '22023';
  end if;
end;
$$;

-- Would `target_id` belong in `me`'s feed for this activity (ignoring swipe
-- history)? Single source of truth for get_feed and like_profile.
create function private.feed_eligible(me public.profiles, target_id uuid, activity uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.profiles t
    join public.user_activities ua on ua.user_id = t.id and ua.activity_id = activity
    where t.id = target_id
      and t.id <> me.id
      and t.verification_status = 'approved'
      and not t.is_banned
      and t.onboarding_complete
      and t.seeking = me.seeking
      and t.gender = any (me.gender_preference)
      and me.gender = any (t.gender_preference)
      and not private.is_blocked_between(me.id, t.id)
  );
$$;

create function private.log_first(uid uuid, event text) returns void
language sql security definer set search_path = '' as $$
  insert into public.events_log (user_id, name)
  select uid, event
  where not exists (select 1 from public.events_log where user_id = uid and name = event);
$$;

-- Serializes likes/responses between the same two people, so a mutual like
-- and an accept can't race into two matches.
create function private.lock_pair(a uuid, b uuid) returns void
language sql set search_path = '' as $$
  select pg_advisory_xact_lock(hashtextextended(least(a, b)::text || greatest(a, b)::text, 0));
$$;

-- Creates the match, its direct conversation (cap 50 × 2 members) and
-- notifies both people. Idempotent per pair and activity.
create function private.create_match(a uuid, b uuid, activity uuid, swipe uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  mid uuid;
  cid uuid;
begin
  insert into public.matches (user_a, user_b, activity_id, swipe_id)
  values (least(a, b), greatest(a, b), activity, swipe)
  on conflict (user_a, user_b, activity_id) do nothing
  returning id into mid;

  if mid is null then
    select m.id, c.id into mid, cid
    from public.matches m join public.conversations c on c.match_id = m.id
    where m.user_a = least(a, b) and m.user_b = greatest(a, b) and m.activity_id = activity;
    return jsonb_build_object('match_id', mid, 'conversation_id', cid);
  end if;

  insert into public.conversations (kind, match_id, message_cap)
  values ('direct', mid, 50 * 2)
  returning id into cid;

  insert into public.conversation_members (conversation_id, user_id) values (cid, a), (cid, b);

  insert into public.notifications (user_id, type, payload)
  select u.me, 'match', jsonb_build_object(
    'match_id', mid,
    'conversation_id', cid,
    'user_id', u.other,
    'first_name', (select first_name from public.profiles where id = u.other)
  )
  from (values (a, b), (b, a)) as u(me, other);

  perform private.log_first(a, 'first_match');
  perform private.log_first(b, 'first_match');

  return jsonb_build_object('match_id', mid, 'conversation_id', cid);
end;
$$;

---------------------------------------------------------------------------
-- Feed
---------------------------------------------------------------------------
-- Returns {profiles: [...], views_left: int|null}. views_left is null for
-- verified callers; for unverified callers every profile served is logged in
-- profile_views and counts against UNVERIFIED_DAILY_VIEW_LIMIT. Profiles
-- already served today are re-served first and don't count again.
create function public.get_feed(p_activity_id uuid, p_limit int default 20) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := private.require_discovery_user();
  n int := least(greatest(coalesce(p_limit, 20), 1), 50);
  verified boolean := me.verification_status = 'approved';
  views_left int;
  picked uuid[];
  added int;
  result jsonb;
begin
  perform private.require_live_activity(me.id, p_activity_id);

  if not verified then
    -- One feed call at a time per viewer, so parallel requests can't each
    -- see the full allowance and bypass the daily limit.
    perform pg_advisory_xact_lock(hashtextextended('feed:' || me.id::text, 0));
    views_left := greatest(
      coalesce((select (value #>> '{}')::int from public.app_config where key = 'UNVERIFIED_DAILY_VIEW_LIMIT'), 30)
      - (select count(*) from public.profile_views where viewer_id = me.id and viewed_on = current_date),
      0);
  end if;

  -- Stable daily shuffle, so reloading the page doesn't reorder the deck.
  select coalesce(array_agg(f.id order by f.ord), '{}') into picked
  from (
  select c.id, row_number() over (order by c.seen desc, c.h) as ord
  from (
    select c.*, row_number() over (partition by c.seen order by c.h) as rank_in_group
    from (
      select
        t.id,
        md5(me.id::text || t.id::text || current_date::text) as h,
        exists (
          select 1 from public.profile_views v
          where v.viewer_id = me.id and v.viewed_id = t.id and v.viewed_on = current_date
        ) as seen
      from public.profiles t
      where private.feed_eligible(me, t.id, p_activity_id)
        -- Not already swiped by the caller (a discarded like can be redone).
        and not exists (
          select 1 from public.swipes s
          where s.from_user = me.id and s.to_user = t.id and s.activity_id = p_activity_id
            and s.status is distinct from 'discarded'
        )
        -- Not someone whose like the caller already answered.
        and not exists (
          select 1 from public.swipes s
          where s.from_user = t.id and s.to_user = me.id and s.activity_id = p_activity_id
            and s.status in ('accepted', 'rejected')
        )
    ) c
  ) c
  where verified or c.seen or c.rank_in_group <= views_left
  order by c.seen desc, c.h
  limit n
  ) f;

  if not verified then
    insert into public.profile_views (viewer_id, viewed_id)
    select me.id, unnest(picked)
    on conflict do nothing;
    get diagnostics added = row_count;
    views_left := views_left - added;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',          t.id,
      'first_name',  t.first_name,
      'public_code', t.public_code,
      'age',         extract(year from age(t.dob))::int,
      'gender',      t.gender,
      'bio',         t.bio,
      'photo_paths', coalesce((select jsonb_agg(ph.storage_path order by ph.position)
                               from public.photos ph where ph.user_id = t.id), '[]'::jsonb)
    ) order by o.ord), '[]'::jsonb)
  into result
  from unnest(picked) with ordinality as o(id, ord)
  join public.profiles t on t.id = o.id;

  return jsonb_build_object('profiles', result, 'views_left', views_left);
end;
$$;

---------------------------------------------------------------------------
-- Like / pass
---------------------------------------------------------------------------
-- Returns {status, matched, match_id?, conversation_id?}.
create function public.like_profile(p_target_id uuid, p_activity_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := private.require_discovery_user();
  mine public.swipes;
  theirs public.swipes;
  swipe_id uuid;
  m jsonb;
begin
  perform private.require_live_activity(me.id, p_activity_id);
  if p_target_id = me.id then
    raise exception 'You can''t like your own profile' using errcode = '22023';
  end if;

  perform private.lock_pair(me.id, p_target_id);

  select * into mine from public.swipes
  where from_user = me.id and to_user = p_target_id and activity_id = p_activity_id;
  if found and mine.status is distinct from 'discarded' then
    -- Already swiped: repeat taps are harmless.
    return jsonb_build_object('status', mine.status, 'matched', mine.status = 'accepted');
  end if;

  -- can_view_profile also enforces that unverified callers were served this
  -- profile by get_feed (the daily view limit).
  if not private.feed_eligible(me, p_target_id, p_activity_id) or not private.can_view_profile(p_target_id) then
    raise exception 'This profile is no longer available' using errcode = '22023';
  end if;

  perform private.log_first(me.id, 'first_like');

  -- Held until the caller is verified (§2.2).
  if me.verification_status <> 'approved' then
    insert into public.swipes (from_user, to_user, activity_id, action, status)
    values (me.id, p_target_id, p_activity_id, 'like', 'held')
    on conflict (from_user, to_user, activity_id)
      do update set action = 'like', status = 'held', created_at = now(), responded_at = null;
    return jsonb_build_object('status', 'held', 'matched', false);
  end if;

  select * into theirs from public.swipes
  where from_user = p_target_id and to_user = me.id and activity_id = p_activity_id and status = 'pending';

  if found then
    -- Mutual like: match straight away.
    insert into public.swipes (from_user, to_user, activity_id, action, status, responded_at)
    values (me.id, p_target_id, p_activity_id, 'like', 'accepted', now())
    on conflict (from_user, to_user, activity_id)
      do update set action = 'like', status = 'accepted', created_at = now(), responded_at = now();
    update public.swipes set status = 'accepted', responded_at = now() where id = theirs.id;
    m := private.create_match(me.id, p_target_id, p_activity_id, theirs.id);
    return jsonb_build_object('status', 'accepted', 'matched', true) || m;
  end if;

  insert into public.swipes (from_user, to_user, activity_id, action, status)
  values (me.id, p_target_id, p_activity_id, 'like', 'pending')
  on conflict (from_user, to_user, activity_id)
    do update set action = 'like', status = 'pending', created_at = now(), responded_at = null
  returning id into swipe_id;

  insert into public.notifications (user_id, type, payload)
  values (p_target_id, 'like_received', jsonb_build_object('swipe_id', swipe_id));

  return jsonb_build_object('status', 'pending', 'matched', false);
end;
$$;

create function public.pass_profile(p_target_id uuid, p_activity_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := private.require_discovery_user();
begin
  perform private.require_live_activity(me.id, p_activity_id);
  if p_target_id = me.id then
    raise exception 'You can''t pass on your own profile' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_target_id) then
    raise exception 'This profile is no longer available' using errcode = '22023';
  end if;

  perform private.lock_pair(me.id, p_target_id);

  insert into public.swipes (from_user, to_user, activity_id, action)
  values (me.id, p_target_id, p_activity_id, 'pass')
  on conflict (from_user, to_user, activity_id) do nothing;

  -- Passing on someone who liked you declines their like, silently.
  update public.swipes set status = 'rejected', responded_at = now()
  where from_user = p_target_id and to_user = me.id and activity_id = p_activity_id and status = 'pending';
end;
$$;

---------------------------------------------------------------------------
-- Approval trigger (§5.1): release or discard held likes
---------------------------------------------------------------------------
create function private.release_held_likes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  s public.swipes;
  theirs_id uuid;
begin
  if new.verification_status = 'rejected' then
    update public.swipes set status = 'discarded'
    where from_user = new.id and status = 'held';
    return null;
  end if;

  for s in
    select * from public.swipes where from_user = new.id and status = 'held' order by created_at
  loop
    if not private.is_active_approved(s.to_user) or private.is_blocked_between(s.from_user, s.to_user) then
      update public.swipes set status = 'discarded' where id = s.id;
      continue;
    end if;

    select id into theirs_id from public.swipes
    where from_user = s.to_user and to_user = s.from_user and activity_id = s.activity_id and status = 'pending';

    if theirs_id is not null then
      update public.swipes set status = 'accepted', responded_at = now() where id in (s.id, theirs_id);
      perform private.create_match(s.from_user, s.to_user, s.activity_id, theirs_id);
    else
      update public.swipes set status = 'pending' where id = s.id;
      insert into public.notifications (user_id, type, payload)
      values (s.to_user, 'like_received', jsonb_build_object('swipe_id', s.id));
    end if;
  end loop;
  return null;
end;
$$;

create trigger profiles_release_held_likes
  after update of verification_status on public.profiles
  for each row
  when (old.verification_status is distinct from new.verification_status
        and new.verification_status in ('approved', 'rejected'))
  execute function private.release_held_likes();

---------------------------------------------------------------------------
-- Incoming likes (§5.2): pending only. Held likes never appear.
---------------------------------------------------------------------------
create function public.get_incoming_likes()
returns table (
  swipe_id    uuid,
  user_id     uuid,
  first_name  text,
  public_code text,
  age         int,
  gender      public.gender,
  bio         text,
  photo_paths text[],
  activity_id uuid,
  liked_at    timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  me public.profiles := private.require_discovery_user();
begin
  return query
    select
      s.id,
      t.id,
      t.first_name,
      t.public_code::text,
      extract(year from age(t.dob))::int,
      t.gender,
      t.bio,
      coalesce((select array_agg(ph.storage_path order by ph.position)
                from public.photos ph where ph.user_id = t.id), '{}'),
      s.activity_id,
      s.created_at
    from public.swipes s
    join public.profiles t on t.id = s.from_user
    where s.to_user = me.id
      and s.status = 'pending'
      and private.is_active_approved(t.id)
      and not private.is_blocked_between(me.id, t.id)
    order by s.created_at desc;
end;
$$;

-- Recipient accepts or declines a pending like. Declining never notifies
-- the liker. Returns {matched, match_id?, conversation_id?}.
create function public.respond_to_like(p_swipe_id uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me public.profiles := private.require_discovery_user();
  s public.swipes;
  m jsonb;
begin
  select * into s from public.swipes where id = p_swipe_id and to_user = me.id;
  if not found then
    raise exception 'This like is no longer available' using errcode = '22023';
  end if;

  perform private.lock_pair(me.id, s.from_user);
  select * into s from public.swipes where id = p_swipe_id;
  if s.status is distinct from 'pending' then
    raise exception 'This like is no longer available' using errcode = '22023';
  end if;

  if not p_accept then
    update public.swipes set status = 'rejected', responded_at = now() where id = s.id;
    insert into public.swipes (from_user, to_user, activity_id, action)
    values (me.id, s.from_user, s.activity_id, 'pass')
    on conflict (from_user, to_user, activity_id) do nothing;
    return jsonb_build_object('matched', false);
  end if;

  if me.verification_status <> 'approved' then
    raise exception 'You can accept likes once you''re verified' using errcode = '22023';
  end if;
  if not private.is_active_approved(s.from_user) or private.is_blocked_between(me.id, s.from_user) then
    raise exception 'This profile is no longer available' using errcode = '22023';
  end if;

  update public.swipes set status = 'accepted', responded_at = now() where id = s.id;
  -- Record the recipient's side too, so neither shows up in the other's feed.
  insert into public.swipes (from_user, to_user, activity_id, action, status, responded_at)
  values (me.id, s.from_user, s.activity_id, 'like', 'accepted', now())
  on conflict (from_user, to_user, activity_id)
    do update set action = 'like', status = 'accepted', responded_at = now();

  m := private.create_match(me.id, s.from_user, s.activity_id, s.id);
  return jsonb_build_object('matched', true) || m;
end;
$$;

---------------------------------------------------------------------------
-- Matches and contact reveal
---------------------------------------------------------------------------
create function public.get_matches()
returns table (
  match_id        uuid,
  conversation_id uuid,
  user_id         uuid,
  first_name      text,
  public_code     text,
  age             int,
  photo_path      text,
  activity_id     uuid,
  matched_at      timestamptz,
  last_message_at timestamptz,
  unread          boolean,
  is_new          boolean
)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  return query
    select
      m.id,
      c.id,
      t.id,
      t.first_name,
      t.public_code::text,
      extract(year from age(t.dob))::int,
      (select ph.storage_path from public.photos ph where ph.user_id = t.id order by ph.position limit 1),
      m.activity_id,
      m.created_at,
      c.last_message_at,
      c.last_message_at is not null and c.last_message_at > coalesce(cm.last_read_at, '-infinity'),
      exists (
        select 1 from public.notifications n
        where n.user_id = uid and n.type = 'match' and n.read_at is null
          and n.payload ->> 'match_id' = m.id::text
      )
    from public.matches m
    join public.conversations c on c.match_id = m.id
    join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = uid
    join public.profiles t on t.id = case when m.user_a = uid then m.user_b else m.user_a end
    where uid in (m.user_a, m.user_b)
      and private.is_active_approved(t.id)
      and not private.is_blocked_between(uid, t.id)
    order by coalesce(c.last_message_at, m.created_at) desc;
end;
$$;

-- Socials of someone the caller has matched with or shares an approved group
-- with, as long as neither has blocked the other.
create function public.get_contact(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  if p_user_id = uid
     or (select is_banned from public.profiles where id = uid)
     or not private.is_active_approved(p_user_id)
     or private.is_blocked_between(uid, p_user_id)
     or not (
       exists (
         select 1 from public.matches
         where user_a = least(uid, p_user_id) and user_b = greatest(uid, p_user_id)
       )
       or exists (
         select 1 from public.group_members g1
         join public.group_members g2 on g2.group_id = g1.group_id
         where g1.user_id = uid and g1.status = 'approved'
           and g2.user_id = p_user_id and g2.status = 'approved'
       )
     ) then
    raise exception 'Contact details are only shared with your matches' using errcode = '42501';
  end if;

  return coalesce((select socials from public.profile_private where user_id = p_user_id), '{}'::jsonb);
end;
$$;

---------------------------------------------------------------------------
-- Realtime: clients listen for their own new notifications (RLS applies).
---------------------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.require_discovery_user(),
  private.require_live_activity(uuid, uuid),
  private.feed_eligible(public.profiles, uuid, uuid),
  private.log_first(uuid, text),
  private.lock_pair(uuid, uuid),
  private.create_match(uuid, uuid, uuid, uuid),
  private.release_held_likes()
from public;

grant execute on function
  public.get_feed(uuid, int),
  public.like_profile(uuid, uuid),
  public.pass_profile(uuid, uuid),
  public.get_incoming_likes(),
  public.respond_to_like(uuid, boolean),
  public.get_matches(),
  public.get_contact(uuid)
to authenticated;
