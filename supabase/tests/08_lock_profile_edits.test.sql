-- KOL-07: gender, dob and first_name (full_name) are locked once
-- verification_status = 'approved'. seeking/gender_preference stay
-- editable any time via update_preferences.
--
-- Seed users used here (see seed.sql):
--   02 Rohan (approved)   20 fresh01 (unsubmitted, nothing filled in)

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

select plan(10);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
create function pg_temp.gender(n int) returns text language sql stable security definer as $$
  select gender::text from public.profiles where id = pg_temp.uid(n);
$$;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;
create function pg_temp.v(key text) returns text language sql stable as $$
  select v from t where k = key;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- seed.sql predates the full_name column, so the approved fixture has none.
-- Give it a known value up front (same pattern as 00_rls_baseline's fixture
-- rows: written before any role switch, as the table owner).
update public.profile_private set full_name = 'Rohan Kumar' where user_id = pg_temp.uid(2);
insert into t select 'dob', dob::text from public.profiles where id = pg_temp.uid(2);

---------------------------------------------------------------------------
-- Direct table write: the grant is gone
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select throws_ok($$update public.profiles set gender = 'woman', dob = '1999-01-01', first_name = 'Rohit'
                   where id = '00000000-0000-0000-0000-000000000002'$$,
                 '42501', null, 'approved user can''t write profiles columns directly any more');

---------------------------------------------------------------------------
-- save_basics: locked once approved
---------------------------------------------------------------------------
select throws_ok(
  format($$select public.save_basics('Rohan Kumar', %L, 'woman', 'group', '{man}', true)$$, pg_temp.v('dob')::date),
  'KL003', null, 'approved user can''t flip gender through save_basics');
select throws_ok(
  format($$select public.save_basics('Rohan Kumar', %L, 'man', 'group', '{woman}', true)$$,
         (pg_temp.v('dob')::date + interval '1 year')::date),
  'KL003', null, 'approved user can''t change dob through save_basics');
select throws_ok(
  format($$select public.save_basics('Rohit Kumar', %L, 'man', 'group', '{woman}', true)$$, pg_temp.v('dob')::date),
  'KL003', null, 'approved user can''t change first name through save_basics');
select lives_ok(
  format($$select public.save_basics('Rohan Kumar', %L, 'man', 'group', '{woman}', true)$$, pg_temp.v('dob')::date),
  'approved user resubmitting unchanged basics is a no-op, not an error');
select is(pg_temp.gender(2), 'man', 'gender is still unchanged after the no-op call');

---------------------------------------------------------------------------
-- update_preferences: unaffected, still editable any time
---------------------------------------------------------------------------
select lives_ok($$select public.update_preferences('friend', '{man,woman}')$$,
                'approved user can still change seeking/preference');
select is((select seeking::text from public.profiles where id = pg_temp.uid(2)), 'friend',
          'preference change actually took effect');
reset role;

---------------------------------------------------------------------------
-- Unverified users are unaffected: basics can still be completed
---------------------------------------------------------------------------
select pg_temp.login_as(20);
select lives_ok($$select public.save_basics('Fresh Person', '2001-05-05', 'woman', 'friend', '{man}', true)$$,
                'unverified user can still complete basics');
select is(pg_temp.gender(20), 'woman', 'unverified user''s basics actually saved');
reset role;

select * from finish();
rollback;
