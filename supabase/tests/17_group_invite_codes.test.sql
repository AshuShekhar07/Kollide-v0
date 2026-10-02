-- Group invite codes: every group's invite has a 6-character code next to the
-- link, and find_invite_code turns a typed code into the link token, with a
-- limit of 10 wrong codes an hour per person.
--
-- Seed users used here (see seed.sql): 02 Rohan, 03 Priya, 04 Arjun
-- (approved), 13 Karan (pending), 18 Varun (banned).

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

select plan(29);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_anon() returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
$$;
create function pg_temp.garba() returns uuid language sql stable as $$
  select id from public.activities where slug = 'garba';
$$;
create temp table t (k text primary key, v text);
grant all on t to anon, authenticated;
create function pg_temp.v(key text) returns text language sql stable as $$
  select v from t where k = key;
$$;
-- Wrong codes this person has typed (events_log isn't readable by clients).
create function pg_temp.misses(n int) returns int language sql stable security definer as $$
  select count(*)::int from public.events_log where user_id = pg_temp.uid(n) and name = 'invite_code_miss';
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

---------------------------------------------------------------------------
-- The admin's code
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into t select 'g', (public.create_group(pg_temp.garba(), 'Rohan''s circle', 'Friday garba', null, 'Palace Grounds', 5)) ->> 'group_id';
insert into t select 'tok', public.get_group_invite_link(pg_temp.v('g')::uuid) ->> 'token';
insert into t select 'code', public.get_group_invite_link(pg_temp.v('g')::uuid) ->> 'code';

select matches(pg_temp.v('code'), '^[A-HJ-NP-Z2-9]{6}$', 'the code is 6 characters from the unambiguous alphabet');
select is(public.get_group_invite_link(pg_temp.v('g')::uuid) ->> 'code', pg_temp.v('code'), 'same code on repeat calls');
select is(public.get_group_invite_link(pg_temp.v('g')::uuid) ->> 'token', pg_temp.v('tok'), 'the link is the same as before');
select is((select array_agg(k order by k) from jsonb_object_keys(public.get_group_invite_link(pg_temp.v('g')::uuid)) k),
          array['code', 'token'], 'it returns exactly the token and the code');

---------------------------------------------------------------------------
-- Typing a code
---------------------------------------------------------------------------
select pg_temp.login_as(3);
select is(public.find_invite_code(pg_temp.v('code')), pg_temp.v('tok'), 'a right code returns the link token');
select is(public.find_invite_code(lower(substr(pg_temp.v('code'), 1, 3)) || ' - ' || substr(pg_temp.v('code'), 4)),
          pg_temp.v('tok'), 'lower case, spaces and dashes are ignored');
select is(public.find_invite_code('OOOOOO'), null, 'a code nobody has returns null');
select is(public.find_invite_code(null), null, 'so does no code at all');
select is(pg_temp.misses(3), 2, 'each wrong code is recorded');
select count(*) from (select public.find_invite_code(pg_temp.v('code')) from generate_series(1, 12)) s;
select is(pg_temp.misses(3), 2, 'right codes are never counted, however many');

---------------------------------------------------------------------------
-- The limit: 10 wrong codes an hour
---------------------------------------------------------------------------
select pg_temp.login_as(4);
select lives_ok($$select count(*) from (select public.find_invite_code('OOOOOO') from generate_series(1, 10)) s$$,
                'ten wrong codes are allowed');
select throws_ok($$select public.find_invite_code(pg_temp.v('code'))$$, 'KL006', null,
                 'the next try is refused, even with the right code');
select is(pg_temp.misses(4), 10, 'a refused try is not counted again');
select pg_temp.login_as(3);
select is(public.find_invite_code(pg_temp.v('code')), pg_temp.v('tok'), 'other people are not affected');
reset role;
update public.events_log set created_at = now() - interval '2 hours'
where user_id = pg_temp.uid(4) and name = 'invite_code_miss';
select pg_temp.login_as(4);
select is(public.find_invite_code(pg_temp.v('code')), pg_temp.v('tok'), 'allowed again once the hour is up');

---------------------------------------------------------------------------
-- Who can use it
---------------------------------------------------------------------------
select pg_temp.login_as(13);
select is(public.find_invite_code(pg_temp.v('code')), pg_temp.v('tok'), 'a person who is not verified yet can type a code too');
select pg_temp.login_as(18);
select throws_ok($$select public.find_invite_code(pg_temp.v('code'))$$, 'KL001', null, 'a banned person is refused');
select pg_temp.as_anon();
select throws_ok($$select public.find_invite_code(pg_temp.v('code'))$$, '42501', null, 'signed-out visitors can''t use it');
reset role;
select ok(has_function_privilege('authenticated', 'public.find_invite_code(text)', 'execute'), 'signed-in people can execute it');
select ok(not has_function_privilege('anon', 'public.find_invite_code(text)', 'execute'), 'anon can''t');
select ok(not exists (
            select 1 from pg_proc p, aclexplode(p.proacl) a
            where p.oid = 'public.find_invite_code(text)'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
          'and it is not granted to PUBLIC');
select ok(not has_function_privilege('authenticated', 'private.new_invite_code()', 'execute')
          and not has_function_privilege('authenticated', 'private.unique_invite_code()', 'execute'),
          'the code generators are private');

---------------------------------------------------------------------------
-- Reset
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into t select 'tok2', public.reset_group_invite_link(pg_temp.v('g')::uuid) ->> 'token';
insert into t select 'code2', public.get_group_invite_link(pg_temp.v('g')::uuid) ->> 'code';
select isnt(pg_temp.v('code2'), pg_temp.v('code'), 'a new link comes with a new code');
select pg_temp.login_as(3);
select is(public.find_invite_code(pg_temp.v('code')), null, 'the old code stops working');
select is(public.find_invite_code(pg_temp.v('code2')), pg_temp.v('tok2'), 'the new code works');

---------------------------------------------------------------------------
-- Closed groups and the table rules
---------------------------------------------------------------------------
insert into t select 'h', (public.create_group(pg_temp.garba(), 'Priya''s circle', null, null, null, 4)) ->> 'group_id';
select public.get_group_invite_link(pg_temp.v('h')::uuid);
reset role;
update public.groups set status = 'closed' where id = pg_temp.v('g')::uuid;
select pg_temp.login_as(3);
select is(public.find_invite_code(pg_temp.v('code2')), null, 'a closed group''s code finds nothing');
reset role;
select throws_ok($$update public.group_invite_links
                   set code = (select code from public.group_invite_links where group_id = pg_temp.v('g')::uuid)
                   where group_id = pg_temp.v('h')::uuid$$,
                 '23505', null, 'two groups can''t share a code');
select throws_ok($$update public.group_invite_links set code = 'abc123' where group_id = pg_temp.v('h')::uuid$$,
                 '23514', null, 'a malformed code is refused');
select is((select count(*)::int from (select private.new_invite_code() c from generate_series(1, 2000)) s
           where c !~ '^[A-HJ-NP-Z2-9]{6}$'),
          0, '2000 generated codes all use the safe alphabet');

select * from finish();
rollback;
