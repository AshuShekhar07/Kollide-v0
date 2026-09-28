-- KOL-06: profiles/photos/user_activities/profile_answers are readable
-- directly only for the caller's own row, or by an admin. Other users'
-- data reaches a caller exclusively through SECURITY DEFINER RPCs.
--
-- Seed users used here (see seed.sql):
--   01 Ananya (admin)   02 Rohan (approved)   03 Priya (approved)
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

select plan(16);

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

-- Give Rohan and Priya some prompt answers to check visibility of.
select pg_temp.login_as(2);
select public.save_about('Civil engineer.', '[{"prompt_key":"weekend","answer":"Cubbon Park runs"},
                                              {"prompt_key":"learning","answer":"Guitar"}]');
select pg_temp.login_as(3);
select public.save_about('Product designer.', '[{"prompt_key":"go_to_song","answer":"Chogada"}]');
reset role;

---------------------------------------------------------------------------
-- Own row only, for a non-admin approved user
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select is((select count(*)::int from public.profiles), 1, 'sees only their own profiles row');
select is((select first_name from public.profiles), 'Rohan', '...and it is correct');
select is((select count(*)::int from public.photos), 2, 'sees only their own photos');
select is((select count(*)::int from public.user_activities), 1, 'sees only their own user_activities row');
select is((select count(*)::int from public.profile_answers), 2, 'sees only their own profile_answers');
reset role;

---------------------------------------------------------------------------
-- Admin still sees every row
---------------------------------------------------------------------------
select pg_temp.login_as(1);
select is((select count(*)::int from public.profiles), 21, 'admin sees every profiles row');
select is((select count(*)::int from public.photos), 40, 'admin sees every photos row');
select is((select count(*)::int from public.user_activities), 20, 'admin sees every user_activities row');
select is((select count(*)::int from public.profile_answers), 3, 'admin sees every profile_answers row');
reset role;

---------------------------------------------------------------------------
-- get_profile_answers: the replacement for the direct cross-user read
---------------------------------------------------------------------------
select pg_temp.login_as(3);
select is((select count(*)::int from public.get_profile_answers(pg_temp.uid(2))), 2,
          'an approved caller can read a visible user''s answers through the RPC');
select pg_temp.login_as(13);
select is((select count(*)::int from public.get_profile_answers(pg_temp.uid(2))), 0,
          'a caller whose feed hasn''t served the target gets nothing back');
reset role;

---------------------------------------------------------------------------
-- No regression: the RPCs that read other users' data are unaffected
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select lives_ok($$select public.get_feed(pg_temp.garba(), 10)$$, 'get_feed still works');
select lives_ok($$select public.get_matches()$$, 'get_matches still works');
select lives_ok($$select public.get_incoming_likes()$$, 'get_incoming_likes still works');
insert into t select 'g', public.create_group(pg_temp.garba(), 'KOL-06 check', null, null, null, 4) ->> 'group_id';
select lives_ok($$select * from public.get_group_interested(pg_temp.v('g')::uuid)$$,
                'get_group_interested still works for the group''s admin');
reset role;

---------------------------------------------------------------------------
-- Storage: signed photo access is unaffected (depends on can_view_profile,
-- not on the profiles/photos table SELECT policies)
---------------------------------------------------------------------------
insert into storage.objects (bucket_id, name) values ('photos', pg_temp.uid(3) || '/seed-0.jpg')
on conflict do nothing;
select pg_temp.login_as(2);
select isnt_empty(
  format($$select 1 from storage.objects where bucket_id = 'photos' and name = %L$$, pg_temp.uid(3) || '/seed-0.jpg'),
  'an approved caller can still read another visible user''s photo object');
reset role;

select * from finish();
rollback;
