-- Phase 3: send_message checks and cap, chat RLS, block, report with
-- snapshot, admin reports queue, bans and re-signup.
--
-- Seed users used here (see seed.sql):
--   01 Ananya (admin)  02 Rohan  03 Priya  04 Arjun  08 Sneha  09 Isha
--   10 Aditya  13 Karan (pending)
-- Seeded likes: Priya→Rohan, Meera→Rohan (pending), Karan→Priya (held).
-- The concurrency acceptance test (parallel senders) lives in
-- web/scripts/chat-cap-concurrency.mjs, since pgTAP runs in one session.

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

select plan(73);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
create function pg_temp.login_id(u uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.garba() returns uuid language sql stable as $$
  select id from public.activities where slug = 'garba';
$$;
-- A new signup with everything filled in, ready for complete_onboarding().
create function pg_temp.ready_user(p_id uuid, p_email text, p_phone text, p_insta text) returns void
language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role) values (p_id, p_email, 'authenticated', 'authenticated');
  update public.profiles set first_name = 'New', dob = '2000-01-01', gender = 'woman',
    gender_preference = '{man}', seeking = 'friend', consent_at = now()
  where id = p_id;
  update public.profile_private set phone = p_phone, socials = jsonb_build_object('instagram', p_insta)
  where user_id = p_id;
  insert into public.photos (user_id, storage_path, position)
  values (p_id, p_id || '/a.jpg', 0), (p_id, p_id || '/b.jpg', 1);
  insert into public.user_activities (user_id, activity_id) values (p_id, pg_temp.garba());
end;
$$;
grant execute on all functions in schema pg_temp to authenticated;

create temp table t (k text primary key, v text);
grant all on t to authenticated;
create function pg_temp.v(key text) returns uuid language sql stable as $$
  select v::uuid from t where k = key;
$$;
grant execute on function pg_temp.v(text) to authenticated;

-- Sneha and Isha matched; Priya also matched with Arjun (for ban freezing).
insert into t select 'si', private.create_match(pg_temp.uid(8), pg_temp.uid(9), pg_temp.garba(), null) ->> 'conversation_id';
insert into t select 'pa', private.create_match(pg_temp.uid(3), pg_temp.uid(4), pg_temp.garba(), null) ->> 'conversation_id';

---------------------------------------------------------------------------
-- send_message: validation
---------------------------------------------------------------------------
select pg_temp.login_as(8);
select is((public.send_message(pg_temp.v('si'), '  Hi Isha!  ') ->> 'remaining')::int, 99,
          'send returns remaining messages (100 cap for 1:1)');
select is((select body from public.get_messages(pg_temp.v('si')) limit 1), 'Hi Isha!',
          'body is trimmed');
select throws_ok($$select public.send_message(pg_temp.v('si'), repeat('a', 501))$$, '22023', null,
                 '501-character message rejected');
select lives_ok($$select public.send_message(pg_temp.v('si'), repeat('a', 500))$$,
                '500-character message allowed');
select throws_ok($$select public.send_message(pg_temp.v('si'), '   ')$$, '22023', null,
                 'blank message rejected');
select throws_ok($$select public.send_message(pg_temp.v('si'), 'see https://evil.example')$$, '22023',
                 'Links aren''t allowed in chat', 'http link rejected');
select throws_ok($$select public.send_message(pg_temp.v('si'), 'go to www.something')$$, '22023', null,
                 'www link rejected');
select throws_ok($$select public.send_message(pg_temp.v('si'), 'my page: Insta.com/me')$$, '22023', null,
                 'bare domain rejected');
select throws_ok($$select public.send_message(pg_temp.v('si'), 'ping me at t.me/sneha')$$, '22023', null,
                 't.me link rejected');
select lives_ok($$select public.send_message(pg_temp.v('si'), 'Meet at 7.30 near gate no. 2, e.g. the food stall?')$$,
                'times, abbreviations and numbers are not links');

-- Only send_message writes messages or counters.
select throws_ok($$insert into public.messages (conversation_id, sender_id, body)
                   values (pg_temp.v('si'), auth.uid(), 'direct')$$, '42501', null,
                 'no direct inserts into messages');
select throws_ok($$update public.conversations set message_count = 0 where id = pg_temp.v('si')$$, '42501', null,
                 'no direct updates to conversations');

---------------------------------------------------------------------------
-- Reading: members only
---------------------------------------------------------------------------
select pg_temp.login_as(9);
select is((select count(*)::int from public.messages where conversation_id = pg_temp.v('si')), 3,
          'the other member reads messages through RLS');
select is((public.get_conversation(pg_temp.v('si')) -> 'members' -> 0 ->> 'first_name'), 'Sneha',
          'get_conversation lists the other member');
select is((public.get_conversation(pg_temp.v('si')) ->> 'message_count')::int, 3,
          'get_conversation returns the count');
select is((select array_agg(first_name) from public.get_matches() where unread), '{Sneha}',
          'unread flag set for the recipient');
select public.mark_conversation_read(pg_temp.v('si'));
select is((select count(*)::int from public.get_matches() where unread), 0, 'mark_conversation_read clears unread');

select pg_temp.login_as(10);
select is((select count(*)::int from public.messages where conversation_id = pg_temp.v('si')), 0,
          'non-members see no messages');
select throws_ok($$select * from public.get_messages(pg_temp.v('si'))$$, '42501', null,
                 'non-members cannot call get_messages');
select throws_ok($$select public.send_message(pg_temp.v('si'), 'hello')$$, '42501', null,
                 'non-members cannot send');
select throws_ok($$select public.get_conversation(pg_temp.v('si'))$$, '42501', null,
                 'non-members cannot read the conversation');

-- Pagination: newest first, strictly older than p_before.
select pg_temp.login_as(8);
select is((select count(*)::int from public.get_messages(pg_temp.v('si'), null, 2)), 2, 'limit respected');
select is((select count(*)::int from public.get_messages(
             pg_temp.v('si'), (select min(created_at) from public.get_messages(pg_temp.v('si'), null, 2)), 50)),
          1, 'p_before pages to older messages');

---------------------------------------------------------------------------
-- Cap: reminders at 80% and 95%, then KL002
---------------------------------------------------------------------------
reset role;
update public.conversations set message_count = 79 where id = pg_temp.v('si');
select pg_temp.login_as(8);
select public.send_message(pg_temp.v('si'), 'eighty');
reset role;
select is((select count(*)::int from public.notifications
           where type = 'chat_cap_warning' and payload ->> 'percent' = '80'
             and payload ->> 'conversation_id' = pg_temp.v('si')::text),
          2, '80% reminder sent to both members');
update public.conversations set message_count = 94 where id = pg_temp.v('si');
select pg_temp.login_as(9);
select public.send_message(pg_temp.v('si'), 'ninety-five');
select public.send_message(pg_temp.v('si'), 'ninety-six');
reset role;
select is((select count(*)::int from public.notifications
           where type = 'chat_cap_warning' and payload ->> 'percent' = '95'
             and payload ->> 'conversation_id' = pg_temp.v('si')::text),
          2, '95% reminder sent once per member, not on every later message');

update public.conversations set message_count = 99 where id = pg_temp.v('si');
select pg_temp.login_as(8);
select is((public.send_message(pg_temp.v('si'), 'last one') ->> 'remaining')::int, 0, 'last message fits');
select throws_ok($$select public.send_message(pg_temp.v('si'), 'one more')$$, 'KL002', null,
                 'sending past the cap fails with KL002');
reset role;
select is((select message_count from public.conversations where id = pg_temp.v('si')), 100,
          'count stops at the cap');
select is((select count(*)::int from public.events_log
           where name = 'chat_cap_reached' and props ->> 'conversation_id' = pg_temp.v('si')::text),
          2, 'chat_cap_reached logged for both members');
select throws_ok($$update public.conversations set message_count = 101 where id = pg_temp.v('si')$$, '23514', null,
                 'check constraint backstops the cap');
update public.conversations set message_count = 10 where id = pg_temp.v('si');

---------------------------------------------------------------------------
-- Block
---------------------------------------------------------------------------
select pg_temp.login_as(9);
select throws_ok($$select public.block_user(auth.uid())$$, '22023', null, 'cannot block yourself');
select throws_ok($$insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), pg_temp.uid(8))$$,
                 '42501', null, 'no direct inserts into blocks');
select lives_ok($$select public.block_user(pg_temp.uid(8))$$, 'Isha blocks Sneha');
select lives_ok($$select public.block_user(pg_temp.uid(8))$$, 'blocking twice is harmless');
reset role;
select ok((select is_frozen from public.conversations where id = pg_temp.v('si')), 'block freezes the direct chat');

select pg_temp.login_as(8);
select throws_ok($$select public.send_message(pg_temp.v('si'), 'hello?')$$, '22023', 'This chat is closed',
                 'blocked user cannot send');
select is(public.get_conversation(pg_temp.v('si')) -> 'members', '[]'::jsonb,
          'blocked chat shows nobody');
select is((select count(*)::int from public.get_matches() where user_id = pg_temp.uid(9)), 0,
          'match hidden from the blocked user');
select pg_temp.login_as(9);
select throws_ok($$select public.send_message(pg_temp.v('si'), 'bye')$$, '22023', null,
                 'the blocker cannot send either (chat frozen)');

-- Blocks drop unanswered likes: Meera→Rohan pending, Karan→Priya held.
select pg_temp.login_as(2);
select public.block_user(pg_temp.uid(5));
select pg_temp.login_as(3);
select public.block_user(pg_temp.uid(13));
reset role;
select is((select status::text from public.swipes where from_user = pg_temp.uid(5) and to_user = pg_temp.uid(2)),
          'rejected', 'block rejects a pending like');
select is((select status::text from public.swipes where from_user = pg_temp.uid(13) and to_user = pg_temp.uid(3)),
          'discarded', 'block discards a held like');

---------------------------------------------------------------------------
-- Report
---------------------------------------------------------------------------
-- Rohan accepts Priya's like, they chat, then Rohan reports Priya.
select pg_temp.login_as(2);
insert into t select 'rp', public.respond_to_like(
  (select swipe_id from public.get_incoming_likes() where first_name = 'Priya'), true) ->> 'conversation_id';
select public.send_message(pg_temp.v('rp'), 'Hey Priya');
select pg_temp.login_as(3);
select public.send_message(pg_temp.v('rp'), 'Something nasty');

select pg_temp.login_as(2);
select throws_ok($$select public.report_user(pg_temp.uid(3), pg_temp.v('rp'), 'harassment', 'x', false)$$,
                 '22023', null, 'report needs consent');
select throws_ok($$select public.report_user(pg_temp.uid(9), pg_temp.v('si'), 'spam', null, true)$$,
                 '22023', null, 'cannot report a chat you are not in');
insert into t select 'report', public.report_user(pg_temp.uid(3), pg_temp.v('rp'), 'harassment', '  Rude messages  ', true);
select ok(pg_temp.v('report') is not null, 'report created');
select throws_ok($$select public.report_user(pg_temp.uid(3), pg_temp.v('rp'), 'harassment', null, true)$$,
                 '22023', null, 'duplicate open report rejected');
select throws_ok('select * from public.reports', '42501', null, 'reporters cannot read reports');
select is((select count(*)::int from public.blocks where blocked_id = pg_temp.uid(3)), 1,
          'reporter blocks the reported user automatically');

reset role;
select ok((select retained and is_frozen from public.conversations where id = pg_temp.v('rp')),
          'reported chat is retained and frozen');
select is((select jsonb_array_length(snapshot #> '{conversation,messages}') from public.reports where id = pg_temp.v('report')),
          2, 'snapshot holds every message');
select is((select snapshot #>> '{conversation,messages,1,sender_id}' from public.reports where id = pg_temp.v('report')),
          pg_temp.uid(3)::text, 'snapshot keeps sender ids');
select is((select details from public.reports where id = pg_temp.v('report')), 'Rude messages', 'details trimmed');

---------------------------------------------------------------------------
-- Admin: queue, logged access, resolution
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select throws_ok('select * from public.admin_reports_queue()', '42501', null, 'queue is admin-only');
select throws_ok($$select public.admin_get_report(pg_temp.v('report'))$$, '42501', null,
                 'report details are admin-only');
select throws_ok($$select public.admin_resolve_report(pg_temp.v('report'), 'ban')$$, '42501', null,
                 'resolution is admin-only');

select pg_temp.login_as(1);
select is((select reported_name from public.admin_reports_queue() where report_id = pg_temp.v('report')), 'Priya',
          'report appears in the queue');
select is((public.admin_get_report(pg_temp.v('report')) ->> 'status'), 'reviewing',
          'opening a report moves it to reviewing');
reset role;
select is((select count(*)::int from public.admin_access_log
           where action = 'view_report' and target_id = pg_temp.v('report')),
          1, 'opening a report is logged');

select pg_temp.login_as(1);
select lives_ok($$select public.admin_resolve_report(pg_temp.v('report'), 'ban')$$, 'admin bans Priya');
select throws_ok($$select public.admin_resolve_report(pg_temp.v('report'), 'no_action')$$, '22023', null,
                 'cannot resolve twice');
reset role;
select is((select array_agg(kind::text || '=' || value_normalized order by kind) from public.bans
           where report_id = pg_temp.v('report')),
          '{email=approved02@kollide.test,phone=+919800000003,instagram=approved02}',
          'ban covers email, phone and every social handle');
select ok((select is_banned from public.profiles where id = pg_temp.uid(3)), 'profile marked banned');
select ok((select is_frozen from public.conversations where id = pg_temp.v('pa')),
          'ban freezes the banned user''s other chats');
select is((select count(*)::int from public.admin_access_log
           where action = 'resolve_report' and target_id = pg_temp.v('report')),
          1, 'resolution is logged');

select pg_temp.login_as(3);
select throws_ok($$select public.send_message(pg_temp.v('pa'), 'hi')$$, 'KL001', null, 'banned users cannot send');
select pg_temp.login_as(4);
select is((select count(*)::int from public.get_matches() where user_id = pg_temp.uid(3)), 0,
          'banned user drops out of matches');

---------------------------------------------------------------------------
-- Account deletion and re-signup
---------------------------------------------------------------------------
reset role;
delete from auth.users where id = pg_temp.uid(3);
select is((select jsonb_array_length(snapshot #> '{conversation,messages}') from public.reports where id = pg_temp.v('report')),
          2, 'report snapshot survives the reported user deleting their account');
select is((select snapshot #>> '{reported,first_name}' from public.reports where id = pg_temp.v('report')),
          'Priya', 'snapshot keeps who was reported');

select pg_temp.ready_user('b0000000-0000-0000-0000-000000000001', 'Approved02@Kollide.test', '+919111111111', 'fresh_a');
select pg_temp.ready_user('b0000000-0000-0000-0000-000000000002', 'other1@example.com', '+919800000003', 'fresh_b');
select pg_temp.ready_user('b0000000-0000-0000-0000-000000000003', 'other2@example.com', '+919222222222', '@Approved02');
select pg_temp.ready_user('b0000000-0000-0000-0000-000000000004', 'other3@example.com', '+919333333333', 'fresh_c');
-- save_contact normalizes handles; mirror that for the handle written directly above.
update public.profile_private set socials = '{"instagram": "approved02"}'
where user_id = 'b0000000-0000-0000-0000-000000000003';

select pg_temp.login_id('b0000000-0000-0000-0000-000000000001');
select throws_ok('select public.complete_onboarding()', 'KL001', null, 're-signup with the banned email blocked');
select pg_temp.login_id('b0000000-0000-0000-0000-000000000002');
select throws_ok('select public.complete_onboarding()', 'KL001', null, 're-signup with the banned phone blocked');
select pg_temp.login_id('b0000000-0000-0000-0000-000000000003');
select throws_ok('select public.complete_onboarding()', 'KL001', null, 're-signup with a banned social blocked');
select pg_temp.login_id('b0000000-0000-0000-0000-000000000004');
select lives_ok('select public.complete_onboarding()', 'unrelated signup still works');

---------------------------------------------------------------------------
-- Warning resolution leaves the account alone
---------------------------------------------------------------------------
select pg_temp.login_as(8);
insert into t select 'warn', public.report_user(pg_temp.uid(9), null, 'fake_profile', null, true);
select pg_temp.login_as(1);
select public.admin_resolve_report(pg_temp.v('warn'), 'warning');
reset role;
select ok(not (select is_banned from public.profiles where id = pg_temp.uid(9)), 'warning does not ban');
select is((select count(*)::int from public.bans where report_id = pg_temp.v('warn')), 0, 'warning adds no bans');

select * from finish();
rollback;
