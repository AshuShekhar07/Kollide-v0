-- Phase 0 acceptance: anonymous and unrelated logged-in users cannot read
-- profile_private, messages, reports or verification_videos.
-- Relies on seed.sql users (fixed IDs 00000000-0000-0000-0000-0000000000NN).

begin;
create extension if not exists pgtap with schema extensions;
-- Migrations revoke PUBLIC execute on new functions, which includes pgTAP's.
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

select plan(22);

-- Fixture: a direct chat between approved01 (…02) and approved03 (…04).
insert into public.swipes (id, from_user, to_user, activity_id, action, status)
values ('10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004',
        (select id from public.activities where slug = 'garba'), 'like', 'accepted');
insert into public.matches (id, user_a, user_b, activity_id, swipe_id)
values ('20000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000004',
        (select id from public.activities where slug = 'garba'),
        '10000000-0000-0000-0000-000000000001');
insert into public.conversations (id, kind, match_id, message_cap)
values ('30000000-0000-0000-0000-000000000001', 'direct', '20000000-0000-0000-0000-000000000001', 100);
insert into public.conversation_members (conversation_id, user_id) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'),
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004');
insert into public.messages (conversation_id, sender_id, body) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'hey, garba on saturday?');

create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', '00000000-0000-0000-0000-' || lpad(n::text, 12, '0'),
                             'role', 'authenticated')::text, true);
$$;

---------------------------------------------------------------------------
-- Anonymous
---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok('select * from public.profile_private', '42501', null, 'anon cannot read profile_private');
select throws_ok('select * from public.messages', '42501', null, 'anon cannot read messages');
select throws_ok('select * from public.reports', '42501', null, 'anon cannot read reports');
select throws_ok('select id from public.verification_videos', '42501', null, 'anon cannot read verification_videos');
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.bans', '42501', null, 'anon cannot read bans');
select isnt_empty('select * from public.activities', 'anon can read activities');

reset role;

---------------------------------------------------------------------------
-- Random logged-in approved user: approved02 (…03), not in the chat
---------------------------------------------------------------------------
select pg_temp.login_as(3);

select is((select count(*)::int from public.profile_private), 1, 'user sees only their own profile_private row');
select is((select user_id from public.profile_private),
          '00000000-0000-0000-0000-000000000003'::uuid, '…and it is theirs');
select is_empty('select * from public.messages', 'non-member sees no messages');
select is_empty('select * from public.conversations', 'non-member sees no conversations');
select throws_ok('select * from public.reports', '42501', null, 'user cannot read reports (even their own)');
select is_empty($$select id from public.verification_videos where user_id <> '00000000-0000-0000-0000-000000000003'$$,
                'user cannot see other users'' verification videos');
select throws_ok('select storage_path from public.verification_videos', '42501', null,
                 'user cannot read video storage paths');
select throws_ok($$insert into public.messages (conversation_id, sender_id, body)
                   values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'x')$$,
                 '42501', null, 'user cannot insert messages directly');
select throws_ok($$update public.profiles set verification_status = 'approved'
                   where id = '00000000-0000-0000-0000-000000000003'$$,
                 '42501', null, 'user cannot change their own verification status');

reset role;

---------------------------------------------------------------------------
-- Unverified user: fresh01 (…20) cannot browse profiles directly
---------------------------------------------------------------------------
select pg_temp.login_as(20);

select is((select count(*)::int from public.profiles), 1, 'unverified user sees only their own profile');
select is_empty('select * from public.messages', 'unverified user sees no messages');

reset role;

---------------------------------------------------------------------------
-- Positive controls: policies grant exactly what they should
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select is((select count(*)::int from public.messages), 1, 'chat member can read their conversation');
reset role;

select pg_temp.login_as(13);
select is((select count(*)::int from public.verification_videos), 1, 'pending user sees their own video row');
reset role;

select pg_temp.login_as(1);
select is((select count(*)::int from public.profile_private), 21, 'admin can read all profile_private rows');
select throws_ok('select * from public.reports', '42501', null, 'admin reads reports only via logging RPCs');
reset role;

select * from finish();
rollback;
