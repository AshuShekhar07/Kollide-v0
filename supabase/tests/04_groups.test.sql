-- Phase 4: groups. Create, browse, request, invite, respond, leave, remove,
-- admin transfer, the member limit, the growing chat cap, blocks and bans.
--
-- Seed users used here (see seed.sql), all approved unless noted:
--   02 Rohan  03 Priya  04 Arjun  05 Meera  06 Kabir  07 Vikram  08 Sneha
--   09 Isha  10 Aditya  11 Sam  12 Diya  13 Karan (pending)
-- The parallel-accept acceptance test (member limit under concurrency) lives
-- in web/scripts/group-capacity-concurrency.mjs, since pgTAP runs in one session.

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

select plan(97);

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
grant execute on all functions in schema pg_temp to authenticated;

create temp table t (k text primary key, v text);
grant all on t to authenticated;
create function pg_temp.v(key text) returns uuid language sql stable as $$
  select v::uuid from t where k = key;
$$;
grant execute on function pg_temp.v(text) to authenticated;
-- Read as postgres, whatever the current test role.
create function pg_temp.cap(key text) returns int language sql stable security definer as $$
  select message_cap from public.conversations where group_id = pg_temp.v(key);
$$;
create function pg_temp.gstatus(key text) returns text language sql stable security definer as $$
  select status::text from public.groups where id = pg_temp.v(key);
$$;
create function pg_temp.mstatus(key text, n int) returns text language sql stable security definer as $$
  select status::text || '/' || role::text from public.group_members where group_id = pg_temp.v(key) and user_id = pg_temp.uid(n);
$$;
create function pg_temp.admin_of(key text) returns uuid language sql stable security definer as $$
  select admin_id from public.groups where id = pg_temp.v(key);
$$;
create function pg_temp.notes(n int, kind text) returns int language sql stable security definer as $$
  select count(*)::int from public.notifications where user_id = pg_temp.uid(n) and type = kind;
$$;
create function pg_temp.frozen(key text) returns boolean language sql stable security definer as $$
  select is_frozen from public.conversations where id = pg_temp.v(key);
$$;
create function pg_temp.events(event text, n int) returns int language sql stable security definer as $$
  select count(*)::int from public.events_log where name = event and user_id = pg_temp.uid(n);
$$;
create function pg_temp.public_code(n int) returns text language sql stable security definer as $$
  select public_code::text from public.profiles where id = pg_temp.uid(n);
$$;
grant execute on all functions in schema pg_temp to authenticated;

---------------------------------------------------------------------------
-- Verified only
---------------------------------------------------------------------------
select pg_temp.login_as(13);
select throws_ok($$select public.create_group(pg_temp.garba(), 'Karan''s group', null, null, null, 4)$$,
                 '22023', null, 'unverified user can''t create a group');
select throws_ok($$select * from public.get_groups(pg_temp.garba())$$, '22023', null,
                 'unverified user can''t browse groups');

---------------------------------------------------------------------------
-- create_group validation
---------------------------------------------------------------------------
select pg_temp.login_as(3);
select throws_ok($$select public.create_group(pg_temp.garba(), 'Too big', null, null, null, 11)$$,
                 '22023', null, 'more than 10 members rejected');
select throws_ok($$select public.create_group(pg_temp.garba(), 'Too small', null, null, null, 1)$$,
                 '22023', null, 'fewer than 2 members rejected');
select throws_ok($$select public.create_group(pg_temp.garba(), '   ', null, null, null, 4)$$,
                 '22023', null, 'blank title rejected');
select throws_ok($$select public.create_group(pg_temp.garba(), 'Old', null, current_date - 2, null, 4)$$,
                 '22023', null, 'past date rejected');
select throws_ok($$select public.create_group(pg_temp.garba(), 'Spam', 'join at t.me/spam', null, null, 4)$$,
                 '22023', null, 'links in the description rejected');
select throws_ok($$select public.create_group((select id from public.activities where status = 'coming_soon' limit 1),
                   'Trek', null, null, null, 4)$$,
                 '22023', null, 'groups only for a live activity the user picked');

-- Priya's group, max 3.
insert into t select 'g', public.create_group(pg_temp.garba(), '  Palace Grounds Saturday  ', 'Meet at gate 2',
                                             current_date + 3, 'Palace Grounds', 3) ->> 'group_id';
insert into t select 'gc', id from public.conversations where group_id = pg_temp.v('g');
select is(public.get_group(pg_temp.v('g')) ->> 'title', 'Palace Grounds Saturday', 'title is trimmed');
select is(pg_temp.cap('g'), 50, 'new group chat starts with a 50-message cap');
select is(pg_temp.mstatus('g', 3), 'approved/admin', 'creator is the approved admin');
select is((public.get_group(pg_temp.v('g')) ->> 'conversation_id')::uuid, pg_temp.v('gc'),
          'admin sees the group chat id');
select is(pg_temp.events('group_created', 3), 1, 'group_created logged');

-- Direct writes are closed.
select throws_ok($$insert into public.groups (activity_id, title, max_members) values (pg_temp.garba(), 'x', 20)$$,
                 '42501', null, 'no direct inserts into groups');
select throws_ok($$update public.group_members set status = 'approved' where user_id = pg_temp.uid(3)$$,
                 '42501', null, 'no direct updates to group_members');

---------------------------------------------------------------------------
-- Browse, request, approve
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select is((select member_count from public.get_groups(pg_temp.garba()) where id = pg_temp.v('g')), 1,
          'Rohan sees the open group with 1 member');
select is(public.request_join(pg_temp.v('g'))::text, 'requested', 'Rohan asks to join');
select throws_ok($$select public.request_join(pg_temp.v('g'))$$, '22023', null, 'can''t ask twice');
select is(pg_temp.notes(3, 'group_join_request'), 1, 'admin is notified of the request');
select throws_ok($$select * from public.get_messages(pg_temp.v('gc'))$$, '42501', null,
                 'requester can''t read the group chat');
select is(public.get_group(pg_temp.v('g')) -> 'conversation_id', 'null'::jsonb,
          'requester doesn''t get the chat id');
select is(public.get_group(pg_temp.v('g')) #> '{members,0,photo_path}', 'null'::jsonb,
          'non-members see names and codes, not photos');
select is(public.get_group(pg_temp.v('g')) #>> '{members,0,public_code}',
          pg_temp.public_code(3), 'members show public codes');
select throws_ok($$select public.get_contact(pg_temp.uid(3))$$, '42501', null,
                 'no socials before approval');

select pg_temp.login_as(4);
select throws_ok($$select public.respond_join_request(pg_temp.v('g'), pg_temp.uid(2), true)$$, '42501', null,
                 'only the group admin can approve');
select throws_ok($$select * from public.get_group_interested(pg_temp.v('g'))$$, '42501', null,
                 'only the group admin sees interested users');

select pg_temp.login_as(3);
select is((select array_agg(status::text || ':' || first_name order by status, first_name)
           from public.get_group_interested(pg_temp.v('g')) where status is not null),
          '{requested:Rohan}', 'interested list starts with pending requests');
select ok(not exists (select 1 from public.get_group_interested(pg_temp.v('g'))
                      where user_id in (pg_temp.uid(3), pg_temp.uid(13), pg_temp.uid(18))),
          'interested list excludes the admin, unverified and banned people');
select ok(exists (select 1 from public.get_group_interested(pg_temp.v('g'))
                  where user_id = pg_temp.uid(6) and status is null),
          'interested list includes verified Garba people to invite');
select throws_ok($$select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(13))$$, '22023', null,
                 'can''t invite an unverified user');
select throws_ok($$select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(2))$$, '22023', null,
                 'can''t invite someone who already asked');
select lives_ok($$select public.respond_join_request(pg_temp.v('g'), pg_temp.uid(2), true)$$, 'admin approves Rohan');
select is(pg_temp.cap('g'), 100, 'cap grows to 100 with 2 members');
select is(pg_temp.notes(2, 'group_approved'), 1, 'Rohan is notified');

select pg_temp.login_as(2);
select is((public.get_group(pg_temp.v('g')) ->> 'conversation_id')::uuid, pg_temp.v('gc'), 'approved member gets the chat');
select isnt(public.get_group(pg_temp.v('g')) #>> '{members,0,photo_path}', null, 'approved members see photos');
select lives_ok($$select public.get_contact(pg_temp.uid(3))$$, 'socials shared once approved');
select is((select count(*)::int from public.get_my_groups() where group_id = pg_temp.v('g') and is_new), 1,
          'group shows as new in Rohan''s matches');
select lives_ok($$select public.send_message(pg_temp.v('gc'), 'Hi all!')$$, 'member sends in the group chat');

---------------------------------------------------------------------------
-- Invites and the member limit
---------------------------------------------------------------------------
select pg_temp.login_as(3);
select lives_ok($$select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(4))$$, 'admin invites Arjun');
select lives_ok($$select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(5))$$, 'admin invites Meera');
select throws_ok($$select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(5))$$, '22023', null, 'can''t invite twice');
select is((select pending_requests from public.get_my_groups() where group_id = pg_temp.v('g')), 0,
          'invites don''t count as pending requests');

select pg_temp.login_as(4);
select is((select count(*)::int from public.get_group_invites() where group_id = pg_temp.v('g')), 1, 'Arjun sees the invite');
select lives_ok($$select public.respond_invite(pg_temp.v('g'), true)$$, 'Arjun accepts');
select is(pg_temp.cap('g'), 150, 'cap grows to 150 with 3 members');
select is(pg_temp.gstatus('g'), 'full', 'group is full at max_members');
select is((select count(*)::int from public.get_messages(pg_temp.v('gc'))), 1, 'new member sees the chat history');

select pg_temp.login_as(5);
select throws_ok($$select public.respond_invite(pg_temp.v('g'), true)$$, '22023', 'This group is full',
                 'invite can''t be accepted once full');
select pg_temp.login_as(6);
select throws_ok($$select public.request_join(pg_temp.v('g'))$$, '22023', 'This group is full',
                 'can''t ask to join a full group');
select ok(not exists (select 1 from public.get_groups(pg_temp.garba()) where id = pg_temp.v('g')),
          'full groups drop out of browse for non-members');

-- Even a direct write can't pass max_members.
reset role;
select throws_ok($$update public.group_members set status = 'approved' where group_id = pg_temp.v('g') and user_id = pg_temp.uid(5)$$,
                 '22023', 'This group is full', 'trigger blocks a 4th approved member');
select is((select count(*)::int from public.group_members where group_id = pg_temp.v('g') and status = 'approved'), 3,
          'group never exceeds max_members');

---------------------------------------------------------------------------
-- Leave keeps the cap; rejoin paths
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select lives_ok($$select public.leave_group(pg_temp.v('g'))$$, 'Rohan leaves');
select is(pg_temp.cap('g'), 150, 'cap stays at 150 after someone leaves');
select is(pg_temp.gstatus('g'), 'open', 'group reopens below max_members');
select throws_ok($$select * from public.get_messages(pg_temp.v('gc'))$$, '42501', null, 'left member can''t read the chat');
select throws_ok($$select public.send_message(pg_temp.v('gc'), 'still here?')$$, '42501', null, 'left member can''t send');
select is(public.request_join(pg_temp.v('g'))::text, 'requested', 'someone who left may ask again');
select lives_ok($$select public.cancel_join_request(pg_temp.v('g'))$$, 'and can withdraw the request');
select is(public.request_join(pg_temp.v('g'))::text, 'requested', 'Rohan asks again');

select pg_temp.login_as(5);
select is(public.request_join(pg_temp.v('g'))::text, 'approved', 'asking to join with an open invite joins at once');
select is(pg_temp.cap('g'), 150, 'cap stays 150 when the count returns to 3');

select pg_temp.login_as(3);
select throws_ok($$select public.respond_join_request(pg_temp.v('g'), pg_temp.uid(2), true)$$, '22023', 'This group is full',
                 'can''t approve past max_members');
select lives_ok($$select public.respond_join_request(pg_temp.v('g'), pg_temp.uid(2), false)$$, 'admin declines');
select pg_temp.login_as(2);
select throws_ok($$select public.request_join(pg_temp.v('g'))$$, '22023', null, 'declined requester can''t ask again');

---------------------------------------------------------------------------
-- Admin transfer, remove, close
---------------------------------------------------------------------------
-- Meera has been in longer than Arjun (approved_at decides, not user order).
reset role;
update public.group_members set approved_at = now() - interval '1 hour'
where group_id = pg_temp.v('g') and user_id = pg_temp.uid(5);

select pg_temp.login_as(3);
select lives_ok($$select public.leave_group(pg_temp.v('g'))$$, 'admin Priya leaves');
select is(pg_temp.admin_of('g'), pg_temp.uid(5), 'admin passes to the longest-standing member');
select is(pg_temp.mstatus('g', 5), 'approved/admin', 'Meera is now the admin');
select is(pg_temp.mstatus('g', 3), 'left/member', 'Priya is a former member');
select is(pg_temp.notes(5, 'group_admin'), 1, 'new admin is notified');
select throws_ok($$select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(6))$$, '42501', null,
                 'former admin has no admin rights');

select pg_temp.login_as(5);
select throws_ok($$select public.remove_member(pg_temp.v('g'), pg_temp.uid(5))$$, '22023', null,
                 'admin can''t remove themself');
select lives_ok($$select public.remove_member(pg_temp.v('g'), pg_temp.uid(4))$$, 'admin removes Arjun');
select is(pg_temp.cap('g'), 150, 'cap never shrinks on removal');
select pg_temp.login_as(4);
select throws_ok($$select public.request_join(pg_temp.v('g'))$$, '22023', null, 'removed member can''t ask again');

select pg_temp.login_as(6);
select is(public.request_join(pg_temp.v('g'))::text, 'requested', 'Kabir asks to join');
select pg_temp.login_as(5);
select lives_ok($$select public.leave_group(pg_temp.v('g'))$$, 'last member leaves');
select is(pg_temp.gstatus('g'), 'closed', 'group closes when nobody is left');
select is(pg_temp.frozen('gc'), true, 'its chat freezes');
select is(pg_temp.mstatus('g', 6), null, 'pending requests are dropped on close');
select pg_temp.login_as(6);
select throws_ok($$select public.get_group(pg_temp.v('g'))$$, '22023', null, 'closed group is gone for outsiders');

---------------------------------------------------------------------------
-- Blocks
---------------------------------------------------------------------------
select pg_temp.login_as(8);
insert into t select 'h', public.create_group(pg_temp.garba(), 'Sneha''s group', null, null, null, 6) ->> 'group_id';
insert into t select 'hc', id from public.conversations where group_id = pg_temp.v('h');
select pg_temp.login_as(9);
select public.block_user(pg_temp.uid(8));
select ok(not exists (select 1 from public.get_groups(pg_temp.garba()) where id = pg_temp.v('h')),
          'group run by someone you blocked is hidden');
select throws_ok($$select public.request_join(pg_temp.v('h'))$$, '22023', null, 'can''t ask to join it');
select is((select count(*)::int from public.groups where id = pg_temp.v('h')), 0, 'hidden from table reads too');
select pg_temp.login_as(8);
select throws_ok($$select public.invite_to_group(pg_temp.v('h'), pg_temp.uid(9))$$, '22023', null,
                 'admin can''t invite someone blocked either way');
select ok(not exists (select 1 from public.get_group_interested(pg_temp.v('h')) where user_id = pg_temp.uid(9)),
          'blocked people aren''t in the interested list');

-- Inside a group, a block only hides the blocked person's messages.
select public.invite_to_group(pg_temp.v('h'), pg_temp.uid(10));
select public.invite_to_group(pg_temp.v('h'), pg_temp.uid(11));
select pg_temp.login_as(10);
select public.respond_invite(pg_temp.v('h'), true);
select pg_temp.login_as(11);
select public.respond_invite(pg_temp.v('h'), true);
select public.block_user(pg_temp.uid(10));
select pg_temp.login_as(10);
select lives_ok($$select public.send_message(pg_temp.v('hc'), 'Hello group')$$, 'blocked member can still post');
select pg_temp.login_as(11);
select is((select count(*)::int from public.get_messages(pg_temp.v('hc'))), 0, 'blocker doesn''t see their messages');
select ok(not (public.get_conversation(pg_temp.v('hc')) -> 'members') @> jsonb_build_array(jsonb_build_object('user_id', pg_temp.uid(10))),
          'blocked member isn''t listed in the chat header');
select pg_temp.login_as(8);
select is((select count(*)::int from public.get_messages(pg_temp.v('hc'))), 1, 'others still see them');
select is(public.get_conversation(pg_temp.v('hc')) #>> '{group,title}', 'Sneha''s group', 'chat header carries the group');

---------------------------------------------------------------------------
-- Bans and account deletion hand the group on
---------------------------------------------------------------------------
reset role;
select private.ban_user(pg_temp.uid(8), null, '{}');
select is(pg_temp.admin_of('h'), pg_temp.uid(10), 'banned admin''s group passes to the next member');
select is(pg_temp.mstatus('h', 8), 'removed/member', 'banned user is removed from the group');
select is(pg_temp.gstatus('h'), 'open', 'group stays open for the rest');

select pg_temp.login_as(12);
insert into t select 'k', public.create_group(pg_temp.garba(), 'Diya''s group', null, null, null, 4) ->> 'group_id';
select public.invite_to_group(pg_temp.v('k'), pg_temp.uid(6));
select pg_temp.login_as(6);
select public.respond_invite(pg_temp.v('k'), true);
reset role;
delete from auth.users where id = pg_temp.uid(12);
select is(pg_temp.admin_of('k'), pg_temp.uid(6), 'deleted admin''s group passes to the next member');

---------------------------------------------------------------------------
-- Limits
---------------------------------------------------------------------------
select pg_temp.login_as(7);
select public.create_group(pg_temp.garba(), 'One', null, null, null, 4);
select public.create_group(pg_temp.garba(), 'Two', null, null, null, 4);
select public.create_group(pg_temp.garba(), 'Three', null, null, null, 4);
select throws_ok($$select public.create_group(pg_temp.garba(), 'Four', null, null, null, 4)$$, '22023', null,
                 'at most 3 groups run at a time');

select * from finish();
rollback;
