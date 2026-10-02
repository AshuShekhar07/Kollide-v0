-- Beyond Bangalore: people and groups within 80 km.
--
-- Kollide was Bangalore-only, checked on the device. Now each profile keeps a
-- coarse position (rounded to about 1 km) and a city label, set either from
-- the phone's location or by picking a city. Discovery, the groups list and
-- a group admin's "interested people" only show people within 80 km.
--
-- Positions never leave these functions: profiles is "own row, or admin"
-- (KOL-06), and no RPC returns anyone else's city, lat or lng.
--
-- Error codes: KL004 no location set yet; KL005 too many location changes.

---------------------------------------------------------------------------
-- Cities: labels for positions, and the list people pick from
---------------------------------------------------------------------------
create table public.cities (
  slug    text primary key check (slug ~ '^[a-z_]+$'),
  name    text not null,
  lat     double precision not null,
  lng     double precision not null,
  -- Shown first in the picker, in this order; null = search only.
  popular smallint
);

alter table public.cities enable row level security;
grant select on public.cities to anon, authenticated;
create policy cities_select on public.cities
  for select to anon, authenticated
  using (true);

insert into public.cities (slug, name, lat, lng, popular) values
  ('bengaluru',          'Bengaluru',          12.9716, 77.5946, 1),
  ('delhi',              'Delhi',              28.6139, 77.2090, 2),
  ('mumbai',             'Mumbai',             19.0760, 72.8777, 3),
  ('hyderabad',          'Hyderabad',          17.3850, 78.4867, 4),
  ('chennai',            'Chennai',            13.0827, 80.2707, 5),
  ('pune',               'Pune',               18.5204, 73.8567, 6),
  ('ahmedabad',          'Ahmedabad',          23.0225, 72.5714, 7),
  ('surat',              'Surat',              21.1702, 72.8311, 8),
  ('kolkata',            'Kolkata',            22.5726, 88.3639, 9),
  ('vadodara',           'Vadodara',           22.3072, 73.1812, 10),
  ('jaipur',             'Jaipur',             26.9124, 75.7873, 11),
  ('gurugram',           'Gurugram',           28.4595, 77.0266, 12),
  ('noida',              'Noida',              28.5355, 77.3910, 13),
  ('rajkot',             'Rajkot',             22.3039, 70.8022, 14),
  ('indore',             'Indore',             22.7196, 75.8577, 15),
  ('lucknow',            'Lucknow',            26.8467, 80.9462, 16),
  ('chandigarh',         'Chandigarh',         30.7333, 76.7794, 17),
  ('kochi',              'Kochi',              9.9312,  76.2673, 18),
  ('gandhinagar',        'Gandhinagar',        23.2156, 72.6369, null),
  ('bhavnagar',          'Bhavnagar',          21.7645, 72.1519, null),
  ('jamnagar',           'Jamnagar',           22.4707, 70.0577, null),
  ('navi_mumbai',        'Navi Mumbai',        19.0330, 73.0297, null),
  ('thane',              'Thane',              19.2183, 72.9781, null),
  ('nashik',             'Nashik',             19.9975, 73.7898, null),
  ('nagpur',             'Nagpur',             21.1458, 79.0882, null),
  ('kolhapur',           'Kolhapur',           16.7050, 74.2433, null),
  ('goa',                'Goa',                15.4909, 73.8278, null),
  ('mysuru',             'Mysuru',             12.2958, 76.6394, null),
  ('mangaluru',          'Mangaluru',          12.9141, 74.8560, null),
  ('hubballi',           'Hubballi',           15.3647, 75.1240, null),
  ('coimbatore',         'Coimbatore',         11.0168, 76.9558, null),
  ('madurai',            'Madurai',            9.9252,  78.1198, null),
  ('tiruchirappalli',    'Tiruchirappalli',    10.7905, 78.7047, null),
  ('puducherry',         'Puducherry',         11.9416, 79.8083, null),
  ('thiruvananthapuram', 'Thiruvananthapuram', 8.5241,  76.9366, null),
  ('visakhapatnam',      'Visakhapatnam',      17.6868, 83.2185, null),
  ('vijayawada',         'Vijayawada',         16.5062, 80.6480, null),
  ('bhopal',             'Bhopal',             23.2599, 77.4126, null),
  ('gwalior',            'Gwalior',            26.2183, 78.1828, null),
  ('jabalpur',           'Jabalpur',           23.1815, 79.9864, null),
  ('raipur',             'Raipur',             21.2514, 81.6296, null),
  ('udaipur',            'Udaipur',            24.5854, 73.7125, null),
  ('jodhpur',            'Jodhpur',            26.2389, 73.0243, null),
  ('agra',               'Agra',               27.1767, 78.0081, null),
  ('kanpur',             'Kanpur',             26.4499, 80.3319, null),
  ('prayagraj',          'Prayagraj',          25.4358, 81.8463, null),
  ('varanasi',           'Varanasi',           25.3176, 82.9739, null),
  ('dehradun',           'Dehradun',           30.3165, 78.0322, null),
  ('shimla',             'Shimla',             31.1048, 77.1734, null),
  ('ludhiana',           'Ludhiana',           30.9010, 75.8573, null),
  ('amritsar',           'Amritsar',           31.6340, 74.8723, null),
  ('jammu',              'Jammu',              32.7266, 74.8570, null),
  ('srinagar',           'Srinagar',           34.0837, 74.7973, null),
  ('patna',              'Patna',              25.5941, 85.1376, null),
  ('ranchi',             'Ranchi',             23.3441, 85.3096, null),
  ('bhubaneswar',        'Bhubaneswar',        20.2961, 85.8245, null),
  ('siliguri',           'Siliguri',           26.7271, 88.3953, null),
  ('guwahati',           'Guwahati',           26.1445, 91.7362, null),
  ('shillong',           'Shillong',           25.5788, 91.8933, null)
on conflict (slug) do nothing;

---------------------------------------------------------------------------
-- Where each person and group is
---------------------------------------------------------------------------
-- location_source: 'gps' from the phone, 'city' picked by hand (the app
-- then stops refreshing it from the phone), null = set by this migration.
alter table public.profiles
  add column city                text check (char_length(city) <= 60),
  add column lat                 double precision check (lat between -90 and 90),
  add column lng                 double precision check (lng between -180 and 180),
  add column location_source     text check (location_source in ('gps', 'city')),
  add column location_updated_at timestamptz,
  add constraint profiles_location_check check ((lat is null) = (lng is null));

-- A group is where its creator was when they started it.
alter table public.groups
  add column city text check (char_length(city) <= 60),
  add column lat  double precision check (lat between -90 and 90),
  add column lng  double precision check (lng between -180 and 180),
  add constraint groups_location_check check ((lat is null) = (lng is null));

-- Everyone so far signed up for Bangalore.
update public.profiles set city = 'Bengaluru', lat = 12.97, lng = 77.59;
update public.groups   set city = 'Bengaluru', lat = 12.97, lng = 77.59;

---------------------------------------------------------------------------
-- Distance
---------------------------------------------------------------------------
-- Great-circle distance in km; null if either point is unknown.
create function private.distance_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns float8
language sql immutable set search_path = '' as $$
  select 6371 * 2 * asin(least(1, sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2
    + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  )));
$$;

-- The discovery radius. The app says "within 80 km" too.
create function private.within_reach(lat1 float8, lng1 float8, lat2 float8, lng2 float8) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(private.distance_km(lat1, lng1, lat2, lng2) <= 80, false);
$$;

---------------------------------------------------------------------------
-- Setting your location
---------------------------------------------------------------------------
-- Pick a city: the profile moves to its centre. Returns {city, source}.
create function public.set_my_city(p_city text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  c public.cities;
begin
  select * into c from public.cities where slug = p_city;
  if not found then
    raise exception 'Please pick a city from the list' using errcode = '22023';
  end if;

  update public.profiles set
    city = c.name, lat = c.lat, lng = c.lng,
    location_source = 'city', location_updated_at = now()
  where id = uid;

  return jsonb_build_object('city', c.name, 'source', 'city');
end;
$$;

-- The phone's position, rounded to about 1 km and labelled with the nearest
-- city. Positions far from every city on the list are refused, so the app
-- asks the person to pick one. Up to 20 changes a day, so nobody can step
-- their position around to work out where someone else is.
create function public.set_my_position(p_lat float8, p_lng float8) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  v_lat float8 := round(p_lat::numeric, 2)::float8;
  v_lng float8 := round(p_lng::numeric, 2)::float8;
  cur public.profiles;
  nearest public.cities;
  d float8;
  label text;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'We couldn''t read your location. Pick a city instead.' using errcode = '22023';
  end if;

  select c.* into nearest from public.cities c
  order by private.distance_km(v_lat, v_lng, c.lat, c.lng)
  limit 1;
  d := private.distance_km(v_lat, v_lng, nearest.lat, nearest.lng);
  if d > 250 then
    raise exception 'Kollide isn''t near you yet. Pick the city where you''d like to meet people.' using errcode = '22023';
  end if;
  label := case when d <= 40 then nearest.name else 'Near ' || nearest.name end;

  -- One change at a time per person, so the daily count holds.
  perform pg_advisory_xact_lock(hashtextextended('location:' || uid::text, 0));
  select * into cur from public.profiles where id = uid;

  if cur.location_source is distinct from 'gps' or cur.lat is distinct from v_lat or cur.lng is distinct from v_lng then
    if (select count(*) from public.events_log
        where user_id = uid and name = 'location_set' and created_at > now() - interval '1 day') >= 20 then
      raise exception 'You''ve changed your location a lot today. Try again tomorrow.' using errcode = 'KL005';
    end if;
    insert into public.events_log (user_id, name) values (uid, 'location_set');
  end if;

  update public.profiles set
    city = label, lat = v_lat, lng = v_lng,
    location_source = 'gps', location_updated_at = now()
  where id = uid;

  return jsonb_build_object('city', label, 'source', 'gps');
end;
$$;

---------------------------------------------------------------------------
-- Groups take their creator's location
---------------------------------------------------------------------------
create function private.set_group_location() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select p.city, p.lat, p.lng into new.city, new.lat, new.lng
  from public.profiles p where p.id = new.admin_id;
  if new.lat is null then
    raise exception 'Choose your city first, so people near you can find your group' using errcode = 'KL004';
  end if;
  return new;
end;
$$;

create trigger groups_set_location
  before insert on public.groups
  for each row execute function private.set_group_location();

---------------------------------------------------------------------------
-- Discovery: only people within reach
---------------------------------------------------------------------------
-- Same as 20260930000001, plus the distance check. Someone with no location
-- yet sees nobody, and nobody sees them.
create or replace function private.feed_eligible(me public.profiles, target_id uuid, activity uuid) returns boolean
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
      and private.within_reach(me.lat, me.lng, t.lat, t.lng)
      and not private.is_blocked_between(me.id, t.id)
  );
$$;

-- Same as 20261002000001, but open groups only show up within reach. Groups
-- the caller is in, asked to join or was invited to always show.
create or replace function public.get_groups(p_activity_id uuid)
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
  me public.profiles;
begin
  if not exists (select 1 from public.activities a where a.id = p_activity_id and a.status = 'live') then
    raise exception 'This activity isn''t live yet' using errcode = '22023';
  end if;
  select * into me from public.profiles p where p.id = uid;

  return query
    select g.id, g.title, g.description, g.event_date, g.venue, g.max_members,
           private.group_member_count(g.id), g.status, p.first_name, m.status, g.created_at
    from public.groups g
    left join public.profiles p on p.id = g.admin_id
    left join public.group_members m on m.group_id = g.id and m.user_id = uid
    where g.activity_id = p_activity_id
      and g.status <> 'closed'
      and (g.event_date is null or g.event_date >= private.today_ist())
      and (
        m.status in ('approved', 'requested', 'invited')
        or (g.status = 'open' and private.within_reach(me.lat, me.lng, g.lat, g.lng))
      )
      and private.can_see_group(g, uid)
    order by (m.status = 'approved') desc nulls last, g.event_date nulls last, g.created_at desc;
end;
$$;

-- Same as 20261005000001, but the people the admin can invite are the ones
-- within reach of the group. Requests and invites already made still show.
create or replace function public.get_group_interested(p_group_id uuid)
returns table (
  user_id     uuid,
  first_name  text,
  public_code text,
  age         int,
  bio         text,
  seeking     public.seeking,
  photo_paths text[],
  status      public.group_member_status,
  since       timestamptz,
  via_link    boolean
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
      select m.user_id as id, m.status as st, m.created_at as at, 0 as bucket, m.via_link as vl
      from public.group_members m
      where m.group_id = g.id and m.status in ('requested', 'invited')
      union all
      select * from (
        select ua.user_id, null::public.group_member_status, null::timestamptz, 1, false
        from public.user_activities ua
        join public.profiles p on p.id = ua.user_id
        where ua.activity_id = g.activity_id
          and ua.user_id <> uid
          and private.within_reach(g.lat, g.lng, p.lat, p.lng)
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
           x.st, x.at, x.vl
    from people x
    join public.profiles p on p.id = x.id
    where private.is_active_approved(p.id) and not private.is_blocked_between(uid, p.id)
    order by x.bucket, x.st, x.vl desc, x.at, (p.seeking = 'group') desc, p.created_at desc;
end;
$$;

---------------------------------------------------------------------------
-- Copy
---------------------------------------------------------------------------
update public.prompts set question = 'The best food in my city is…' where key = 'best_food';

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.distance_km(float8, float8, float8, float8),
  private.within_reach(float8, float8, float8, float8),
  private.set_group_location()
from public;

grant execute on function
  public.set_my_city(text),
  public.set_my_position(float8, float8)
to authenticated;
