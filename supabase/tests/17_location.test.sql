-- Beyond Bangalore: people and groups within 80 km (20261016000001).
--
-- Seed users (see seed.sql) all start in Bengaluru, picked by hand:
--   01 Ananya  woman  friend   approved (admin)
--   02 Rohan   man    group    approved, wants women
--   03 Priya   woman  group    approved, wants men
--   05 Meera   woman  group    approved, wants men
--   12 Diya    woman  group    approved, wants men
--   20 fresh: no profile details, no location

begin;
create extension if not exists pgtap with schema extensions;
do $$
declare f regprocedure;
begin
  for f in
    select d.objid::regprocedure from pg_depend d
    join pg_extension e on e.oid = d.refobjid
    where e.extname = 'pgtap' and d.classid = 'pg_proc'::regclass
  loop
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end;
$$;

select plan(27);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
create function pg_temp.garba() returns uuid language sql stable as $$
  select id from public.activities where slug = 'garba';
$$;
create function pg_temp.feed_names() returns text[] language sql as $$
  select coalesce(array_agg(x ->> 'first_name' order by x ->> 'first_name'), '{}')
  from jsonb_array_elements(public.get_feed(pg_temp.garba(), 50) -> 'profiles') x;
$$;
create function pg_temp.group_titles() returns text[] language sql as $$
  select coalesce(array_agg(title order by title), '{}') from public.get_groups(pg_temp.garba());
$$;
grant execute on all functions in schema pg_temp to authenticated;

create temp table t (k text primary key, v text);
grant all on t to authenticated;

---------------------------------------------------------------------------
-- Cities
---------------------------------------------------------------------------
set local role anon;
select ok((select count(*) from public.cities where popular is not null) >= 8,
          'anyone can read the city list');
reset role;

select pg_temp.login_as(3);
select throws_ok($$select public.set_my_city('atlantis')$$, '22023', 'Please pick a city from the list',
                 'unknown city is refused');
select is(public.set_my_city('mumbai') ->> 'city', 'Mumbai', 'picking a city returns its name');
reset role;
select is((select array[city, location_source, lat::text, lng::text] from public.profiles where id = pg_temp.uid(3)),
          array['Mumbai', 'city', '19.076', '72.8777'], 'the profile moves to the city centre');

---------------------------------------------------------------------------
-- Feed: within 80 km only
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select is(pg_temp.feed_names(), '{Diya,Meera}', 'Priya moved to Mumbai, so Rohan in Bengaluru no longer sees her');
select throws_ok(format('select public.like_profile(%L, %L)', pg_temp.uid(3), pg_temp.garba()),
                 '22023', 'This profile is no longer available', 'nor can he kollide with her');

select public.set_my_city('navi_mumbai');
select is(pg_temp.feed_names(), '{Priya}', 'from Navi Mumbai (about 25 km away) Rohan sees Priya, not Bengaluru');

-- Priya already kollided with Rohan in the seed, so check the other way with Diya.
select pg_temp.login_as(12);
select public.set_my_city('mumbai');
select is(pg_temp.feed_names(), '{Rohan}', 'and women in Mumbai see him');
select public.set_my_city('bengaluru');

-- No location yet: nobody, either way.
reset role;
update public.profiles set city = null, lat = null, lng = null, location_source = null where id = pg_temp.uid(2);
select pg_temp.login_as(2);
select is(pg_temp.feed_names(), '{}', 'no location: an empty feed');
select pg_temp.login_as(3);
select is(pg_temp.feed_names(), '{}', 'and nobody sees someone with no location');

---------------------------------------------------------------------------
-- Groups take their creator's location
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select throws_ok($$select public.create_group(pg_temp.garba(), 'Nowhere night', null, null, null, 4)$$,
                 'KL004', null, 'no location: can''t start a group');

select public.set_my_city('mumbai');
insert into t values ('mumbai_group',
  public.create_group(pg_temp.garba(), 'Mumbai night', null, null, null, 4) ->> 'group_id');
reset role;
select is((select city from public.groups where id = (select v::uuid from t where k = 'mumbai_group')),
          'Mumbai', 'the group is where its creator is');

select pg_temp.login_as(5);
insert into t values ('blr_group',
  public.create_group(pg_temp.garba(), 'Bengaluru night', null, null, null, 4) ->> 'group_id');
select is(pg_temp.group_titles(), '{"Bengaluru night"}', 'Meera in Bengaluru sees only the Bengaluru group');

select pg_temp.login_as(3);
select is(pg_temp.group_titles(), '{"Mumbai night"}', 'Priya in Mumbai sees only the Mumbai group');

-- Asked to join, then moved away: the group still shows.
select public.request_join((select v::uuid from t where k = 'mumbai_group'));
select public.set_my_city('bengaluru');
select is(pg_temp.group_titles(), '{"Bengaluru night","Mumbai night"}',
          'a group you asked to join stays listed after you move');
select public.set_my_city('mumbai');

-- The admin's "interested people" are the ones near the group.
select pg_temp.login_as(2);
select is((select array_agg(first_name order by first_name)
           from public.get_group_interested((select v::uuid from t where k = 'mumbai_group'))),
          '{Priya}', 'interested people: only those within reach of the group (plus requests)');
select pg_temp.login_as(5);
select ok(not exists (
            select 1 from public.get_group_interested((select v::uuid from t where k = 'blr_group'))
            where first_name in ('Priya', 'Rohan')),
          'the Bengaluru group''s admin isn''t offered people in Mumbai');

---------------------------------------------------------------------------
-- Phone position: rounded, labelled, limited
---------------------------------------------------------------------------
select pg_temp.login_as(8);
select is(public.set_my_position(12.93521, 77.62448) ->> 'city', 'Bengaluru', 'Koramangala is Bengaluru');
reset role;
select is((select array[city, location_source, lat::text, lng::text] from public.profiles where id = pg_temp.uid(8)),
          array['Bengaluru', 'gps', '12.94', '77.62'], 'stored rounded to about 1 km');

select pg_temp.login_as(8);
select is(public.set_my_position(13.34, 77.10) ->> 'city', 'Near Bengaluru',
          'more than 40 km from the nearest city: "Near ..."');
select throws_ok($$select public.set_my_position(51.5072, -0.1276)$$, '22023', null,
                 'far from every city: refused, so the app asks for a city');
select throws_ok($$select public.set_my_position(null, 77.6)$$, '22023', null, 'missing coordinates are refused');

-- 2 changes so far today; 18 more are fine, the 21st isn't.
select lives_ok($$
  select public.set_my_position(12.90 + n / 100.0, 77.60) from generate_series(1, 18) n
$$, 'up to 20 position changes a day');
select throws_ok($$select public.set_my_position(12.80, 77.60)$$, 'KL005', null, 'the 21st change is refused');
select lives_ok($$select public.set_my_position(13.08, 77.60)$$, 'sending the same position again isn''t a change');
select lives_ok($$select public.set_my_city('pune')$$, 'picking a city is never limited');

---------------------------------------------------------------------------
-- Nobody else can read a position
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select is((select count(*)::int from public.profiles where id = pg_temp.uid(3)), 0,
          'other people''s profile rows (and their location) aren''t readable');

reset role;
select * from finish();
rollback;
