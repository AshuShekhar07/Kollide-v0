-- Someone deciding which group to ask to join can see who is already in it,
-- but nothing about them, so there is no way to judge the group. get_feed
-- already hands any verified user another verified user's photos, age, bio
-- and answers, and the storage policy already signs their photos under
-- private.can_view_profile(); this returns the same fields for one approved
-- member of a group the caller can see, under that same rule. Socials are
-- not included: those stay with the group chat, once you're in.
--
-- Not a widening of profiles_select/photos_select (KOL-06 tightened those to
-- "own row, or admin" on purpose). Like get_profile_answers, this is an RPC
-- with its own authorization, which is the pattern that migration moved to.
create function public.get_group_member_profile(p_group_id uuid, p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups;
  t public.profiles;
begin
  select * into g from public.groups where id = p_group_id;
  if not found or not private.can_see_group(g, uid) then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;

  -- Only people actually in the group, so this can't be used to read a
  -- profile by guessing ids against a group the caller happens to see.
  if not exists (
    select 1 from public.group_members m
    where m.group_id = g.id and m.user_id = p_user_id and m.status = 'approved'
  ) then
    raise exception 'They are not in this group' using errcode = '22023';
  end if;

  -- Covers blocks in either direction, and bans or deactivations on their side.
  if not private.can_view_profile(p_user_id) then
    raise exception 'This profile is not available' using errcode = '22023';
  end if;

  select * into t from public.profiles where id = p_user_id;
  return jsonb_build_object(
    'user_id',     t.id,
    'first_name',  t.first_name,
    'age',         extract(year from age(t.dob))::int,
    'bio',         t.bio,
    'photo_paths', coalesce((
                     select jsonb_agg(ph.storage_path order by ph.position)
                     from public.photos ph where ph.user_id = t.id), '[]'::jsonb),
    'answers',     coalesce((
                     select jsonb_agg(jsonb_build_object(
                         'prompt_key', a.prompt_key,
                         'answer',     a.answer,
                         'question',   q.question) order by a.position)
                     from public.profile_answers a
                     join public.prompts q on q.key = a.prompt_key
                     where a.user_id = t.id), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_group_member_profile(uuid, uuid) to authenticated;

-- The members list hid photo_path from anyone not already in the group, so a
-- prospective member saw a column of initials. Same visibility decision as
-- above: a verified caller who can see the group sees the faces. The list
-- itself already drops anyone blocked either way, or not active+approved.
create or replace function public.get_group(p_group_id uuid) returns jsonb
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
          'photo_path',  (select ph.storage_path from public.photos ph
                          where ph.user_id = p.id order by ph.position limit 1)
        ) order by m.role = 'admin' desc, m.approved_at)
      from public.group_members m
      join public.profiles p on p.id = m.user_id
      where m.group_id = g.id and m.status = 'approved'
        and (p.id = uid or (private.is_active_approved(p.id) and not private.is_blocked_between(uid, p.id)))
    ), '[]'::jsonb)
  );
end;
$$;
