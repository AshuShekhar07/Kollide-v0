-- Full name at signup, and group invite links.
--
-- Seed users used here (see seed.sql), all approved unless noted:
--   02 Rohan  03 Priya  04 Arjun  05 Meera  13 Karan (pending)

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

select plan(39);

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
create function pg_temp.full_name(n int) returns text language sql stable security definer as $$
  select full_name from public.profile_private where user_id = pg_temp.uid(n);
$$;
create function pg_temp.first_name(n int) returns text language sql stable security definer as $$
  select first_name from public.profiles where id = pg_temp.uid(n);
$$;
create function pg_temp.member(n int) returns text language sql stable security definer as $$
  select status::text || '/' || via_link::text from public.group_members
  where group_id = pg_temp.v('g')::uuid and user_id = pg_temp.uid(n);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

---------------------------------------------------------------------------
-- Full name
---------------------------------------------------------------------------
select pg_temp.login_as(13);
select lives_ok($$select public.save_basics('  Karan   Singh  Mehra ', '2000-01-01', 'man', 'group', '{woman}', true)$$,
                'full name saved');
select is(pg_temp.full_name(13), 'Karan Singh Mehra', 'full name trimmed and spaces collapsed');
select is(pg_temp.first_name(13), 'Karan', 'first word becomes the public first name');
select lives_ok($$select public.save_basics('Karthik', '2000-01-01', 'man', 'group', '{woman}', true)$$,
                'single-word name allowed');
select is(pg_temp.first_name(13), 'Karthik', 'single-word name is the first name');
select throws_ok($$select public.save_basics('   ', '2000-01-01', 'man', 'group', '{woman}', true)$$,
                 '22023', null, 'blank name rejected');
select throws_ok($$select public.save_basics('Karan 007', '2000-01-01', 'man', 'group', '{woman}', true)$$,
                 '22023', null, 'digits in name rejected');
select throws_ok($$select public.save_basics(repeat('a', 81), '2000-01-01', 'man', 'group', '{woman}', true)$$,
                 '22023', null, 'over-long name rejected');
select lives_ok($$select public.save_basics('Karan Mehra', '2000-01-01', 'man', 'group', '{woman}', true)$$,
                'restore name');

-- Full names are private: other users can't read profile_private.
select pg_temp.login_as(2);
select is((select count(*)::int from public.profile_private where user_id = pg_temp.uid(13)), 0,
          'other users can''t read someone''s full name');

---------------------------------------------------------------------------
-- Admin gets the link
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into t select 'g', (public.create_group(pg_temp.garba(), 'Rohan''s circle', 'Friday garba', null, 'Palace Grounds', 5)) ->> 'group_id';
insert into t values ('tok', public.get_group_invite_link(pg_temp.v('g')::uuid));
select ok(char_length(pg_temp.v('tok')) = 22, 'token is 22 characters');
select is(public.get_group_invite_link(pg_temp.v('g')::uuid), pg_temp.v('tok'), 'same link on repeat calls');

select pg_temp.login_as(3);
select throws_ok($$select public.get_group_invite_link(pg_temp.v('g')::uuid)$$, '42501', null,
                 'non-admin can''t get the link');
select throws_ok($$select public.reset_group_invite_link(pg_temp.v('g')::uuid)$$, '42501', null,
                 'non-admin can''t reset the link');
select throws_ok($$select * from public.group_invite_links$$, '42501', null,
                 'the token table isn''t readable by clients');

---------------------------------------------------------------------------
-- Preview
---------------------------------------------------------------------------
select pg_temp.as_anon();
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'title', 'Rohan''s circle', 'anyone with the link sees the title');
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'admin_name', 'Rohan', 'preview shows the admin''s first name');
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'group_id', null, 'anon doesn''t get the group id');
select ok(not (public.get_group_invite(pg_temp.v('tok')) ? 'venue'), 'preview leaves out the venue');
select is(public.get_group_invite('not-a-real-token'), null, 'unknown token gives nothing');
select throws_ok($$select public.request_join_by_link(pg_temp.v('tok'))$$, '42501', null,
                 'anon can''t ask to join');

select pg_temp.login_as(13);
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'group_id', null, 'unverified user doesn''t get the group id');
select throws_ok($$select public.request_join_by_link(pg_temp.v('tok'))$$, '22023', null,
                 'unverified user can''t ask to join yet');

select pg_temp.login_as(3);
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'group_id', pg_temp.v('g'), 'verified user gets the group id');
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'my_status', null, 'no status before asking');

---------------------------------------------------------------------------
-- Ask to join through the link
---------------------------------------------------------------------------
select is(public.request_join_by_link(pg_temp.v('tok')) ->> 'status', 'requested', 'request through link');
select is(pg_temp.member(3), 'requested/true', 'request marked as via link');
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'my_status', 'requested', 'preview shows pending request');
select throws_ok($$select public.request_join_by_link(pg_temp.v('tok'))$$, '22023', null,
                 'can''t ask twice');

-- A plain request isn't marked.
select pg_temp.login_as(4);
select is(public.request_join(pg_temp.v('g')::uuid)::text, 'requested', 'plain request still works');
select is(pg_temp.member(4), 'requested/false', 'plain request not marked as via link');

-- The admin sees who came from the link, link requests first.
select pg_temp.login_as(2);
select is((select via_link from public.get_group_interested(pg_temp.v('g')::uuid) where user_id = pg_temp.uid(3)), true,
          'admin sees the link request');
select is((select user_id from public.get_group_interested(pg_temp.v('g')::uuid) limit 1), pg_temp.uid(3),
          'link requests come first');
select lives_ok($$select public.respond_join_request(pg_temp.v('g')::uuid, pg_temp.uid(3), true)$$, 'admin approves');
select pg_temp.login_as(3);
select is(public.get_group_invite(pg_temp.v('tok')) ->> 'my_status', 'approved', 'preview shows membership');

---------------------------------------------------------------------------
-- Reset and blocks
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into t values ('tok2', public.reset_group_invite_link(pg_temp.v('g')::uuid));
select is(public.get_group_invite(pg_temp.v('tok')), null, 'old link stops working after reset');
select isnt(public.get_group_invite(pg_temp.v('tok2')), null, 'new link works');

select pg_temp.login_as(5);
select public.block_user(pg_temp.uid(2));
select is(public.get_group_invite(pg_temp.v('tok2')), null, 'blocked admin''s group is hidden from the link');
select throws_ok($$select public.request_join_by_link(pg_temp.v('tok2'))$$, '22023', null,
                 'can''t join a blocked admin''s group through the link');

select * from finish();
rollback;
