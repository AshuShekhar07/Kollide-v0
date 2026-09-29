-- 20261011000001: someone weighing up a group can open the profile of anyone
-- already in it -- photos, age, intro and answers, the same fields get_feed
-- already hands a verified user about any other verified user -- and the
-- members list itself shows their photos rather than initials.
--
-- Seed users used here (see seed.sql):
--   02 Rohan (approved)   03 Priya (approved)   04 Arjun (approved)
--   13 Karan (pending)

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

select plan(11);

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
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;
create function pg_temp.v(key text) returns text language sql stable as $$
  select v from t where k = key;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Priya fills in her profile, then opens a group.
select pg_temp.login_as(3);
select public.save_about('Product designer.', '[{"prompt_key":"go_to_song","answer":"Chogada"}]');
insert into t select 'g', public.create_group(pg_temp.garba(), 'Palace Grounds Saturday', 'Meet at gate 2',
                                              current_date + 3, 'Palace Grounds', 4) ->> 'group_id';

---------------------------------------------------------------------------
-- A non-member can size up who is already in the group
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into t select 'p', public.get_group_member_profile(pg_temp.v('g')::uuid, pg_temp.uid(3))::text;

select is(pg_temp.v('p')::jsonb ->> 'first_name', 'Priya', 'non-member sees the member''s name');
select is(pg_temp.v('p')::jsonb ->> 'bio', 'Product designer.', '...their intro');
select ok((pg_temp.v('p')::jsonb ->> 'age')::int > 0, '...their age');
select ok(jsonb_array_length(pg_temp.v('p')::jsonb -> 'photo_paths') > 0, '...their photos');
select is(pg_temp.v('p')::jsonb #>> '{answers,0,answer}', 'Chogada', '...and their answers');
select isnt(pg_temp.v('p')::jsonb #>> '{answers,0,question}', null, 'answers carry the question text');

select isnt(public.get_group(pg_temp.v('g')::uuid) #>> '{members,0,photo_path}', null,
            'the members list shows photos to a non-member too');

---------------------------------------------------------------------------
-- It only reaches people actually in that group
---------------------------------------------------------------------------
select throws_ok($$select public.get_group_member_profile(pg_temp.v('g')::uuid, pg_temp.uid(4))$$,
                 '22023', null, 'someone who isn''t in the group can''t be read through it');
select throws_ok($$select public.get_group_member_profile(gen_random_uuid(), pg_temp.uid(3))$$,
                 '22023', null, 'an unknown group is not available');

select pg_temp.login_as(13);
select throws_ok($$select public.get_group_member_profile(pg_temp.v('g')::uuid, pg_temp.uid(3))$$,
                 '22023', null, 'an unverified caller gets nothing');

-- A block puts it back out of reach.
select pg_temp.login_as(3);
select public.block_user(pg_temp.uid(2));
select pg_temp.login_as(2);
select throws_ok($$select public.get_group_member_profile(pg_temp.v('g')::uuid, pg_temp.uid(3))$$,
                 '22023', null, 'a block hides the profile again');

select * from finish();
rollback;
