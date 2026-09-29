-- KOL-08: get_badge_counts() returns the same two numbers the app used to
-- compute from get_incoming_likes, get_group_invites, get_matches and
-- get_my_groups (an RPC that errors counted as 0 in the app, so it does here).
--
-- pg_temp.mismatches() signs in as every seed user (01 to 21) in turn and lists
-- the ones where the two ways disagree; it must be empty at every checkpoint.
-- Each checkpoint also pins explicit numbers, so it is not 0 = 0.
--
-- Seed users (see seed.sql): 01 Ananya (admin), 02 Rohan, 03 Priya, 04 Arjun,
-- 05 Meera, 13 Karan (pending), 18 Varun (banned), 20 fresh, 21 Pooja (no video).
-- Seeded likes: Priya, Meera -> Rohan; Aditya -> Ananya (pending); Karan -> Priya (held).

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

select plan(31);

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

-- The old way, as the app did it: each RPC that errors counts as 0.
create function pg_temp.old_likes() returns int language plpgsql as $$
declare n int := 0;
begin
  begin n := n + (select count(*) from public.get_incoming_likes()); exception when others then null; end;
  begin n := n + (select count(*) from public.get_group_invites()); exception when others then null; end;
  return n;
end;
$$;
create function pg_temp.old_matches() returns int language plpgsql as $$
declare n int := 0;
begin
  begin n := n + (select count(*) from public.get_matches() where is_new or unread); exception when others then null; end;
  begin n := n + (select count(*) from public.get_my_groups() where is_new or unread or pending_requests > 0);
  exception when others then null; end;
  return n;
end;
$$;

-- '' when every seed user agrees, else e.g. '3:1/0 5:0/2' (user:new/old likes... see below).
create function pg_temp.mismatches() returns text language plpgsql as $$
declare
  n int;
  new_likes int; new_matches int; old_l int; old_m int;
  bad text := '';
begin
  for n in 1..21 loop
    perform set_config('request.jwt.claims',
      json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    select b.likes, b.matches into new_likes, new_matches from public.get_badge_counts() b;
    old_l := pg_temp.old_likes();
    old_m := pg_temp.old_matches();
    execute 'reset role';
    if new_likes <> old_l or new_matches <> old_m then
      bad := bad || format('%s:likes %s/%s matches %s/%s ', n, new_likes, old_l, new_matches, old_m);
    end if;
  end loop;
  return bad;
end;
$$;
create temp table t (k text primary key, v text);
create function pg_temp.v(key text) returns uuid language sql stable as $$
  select v::uuid from t where k = key;
$$;
grant all on t to authenticated;
grant execute on all functions in schema pg_temp to authenticated;

---------------------------------------------------------------------------
-- Access
---------------------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'public.get_badge_counts()', 'execute'),
          'signed-in users can call it');
select ok(not has_function_privilege('anon', 'public.get_badge_counts()', 'execute'), 'anon cannot');
select ok(not exists (
            select 1 from pg_proc p, aclexplode(p.proacl) a
            where p.oid = 'public.get_badge_counts()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
          'and it is not granted to PUBLIC');
select is((select prosecdef::text || ':' || (proconfig @> array['search_path=""'])::text
           from pg_proc where oid = 'public.get_badge_counts()'::regprocedure),
          'true:true', 'security definer with an empty search_path');
select throws_ok($$select * from public.get_badge_counts()$$, '42501', null,
                 'an unauthenticated call fails like the other RPCs');

---------------------------------------------------------------------------
-- Seed baseline
---------------------------------------------------------------------------
select is(pg_temp.mismatches(), '', 'baseline: matches the four RPCs for every seed user');
select pg_temp.login_as(2);
select is((select array[likes, matches] from public.get_badge_counts()), array[2, 0], 'Rohan: two likes waiting');
select pg_temp.login_as(1);
select is((select array[likes, matches] from public.get_badge_counts()), array[1, 0], 'Ananya: one like waiting');
select pg_temp.login_as(3);
select is((select array[likes, matches] from public.get_badge_counts()), array[0, 0], 'Priya: nothing');
reset role;

-- Likes to people who can't use discovery: the old RPC raised and the app
-- counted 0. Pending Karan can use discovery, so his counts.
insert into public.swipes (from_user, to_user, activity_id, action, status)
values (pg_temp.uid(4), pg_temp.uid(13), pg_temp.garba(), 'like', 'pending'),
       (pg_temp.uid(4), pg_temp.uid(21), pg_temp.garba(), 'like', 'pending'),
       (pg_temp.uid(4), pg_temp.uid(18), pg_temp.garba(), 'like', 'pending'),
       (pg_temp.uid(4), pg_temp.uid(20), pg_temp.garba(), 'like', 'pending');
select is(pg_temp.mismatches(), '', 'likes to pending, banned, no-video and fresh users match the RPCs');
select pg_temp.login_as(13);
select is((select likes from public.get_badge_counts()), 1, 'pending Karan sees his like');
select pg_temp.login_as(21);
select is((select array[likes, matches] from public.get_badge_counts()), array[0, 0],
          'no-video Pooja: 0, no error');
select pg_temp.login_as(18);
select is((select array[likes, matches] from public.get_badge_counts()), array[0, 0], 'banned Varun: 0, no error');
select pg_temp.login_as(20);
select is((select array[likes, matches] from public.get_badge_counts()), array[0, 0], 'fresh signup: 0, no error');
reset role;

---------------------------------------------------------------------------
-- A match (is_new), then messages (unread), then read
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into t select 'rp', public.respond_to_like(
  (select swipe_id from public.get_incoming_likes() where first_name = 'Priya'), true) ->> 'conversation_id';
select is((select array[likes, matches] from public.get_badge_counts()), array[1, 1],
          'Rohan after accepting: Meera''s like left, one new match');
reset role;
select is(pg_temp.mismatches(), '', 'after a match: matches the four RPCs');

-- Both have seen the match; only unread messages count from here.
update public.notifications set read_at = now() where type = 'match';
select is(pg_temp.mismatches(), '', 'match notifications read: still the same');
select pg_temp.login_as(3);
select is((select matches from public.get_badge_counts()), 0, 'Priya: nothing new once the match is seen');
select pg_temp.login_as(2);
select public.send_message(pg_temp.v('rp'), 'Hey Priya');
select is((select matches from public.get_badge_counts()), 0, 'the sender has nothing unread');
select pg_temp.login_as(3);
select is((select matches from public.get_badge_counts()), 1, 'Priya has an unread chat');
reset role;
select is(pg_temp.mismatches(), '', 'with an unread message: matches the four RPCs');
select pg_temp.login_as(3);
select public.mark_conversation_read(pg_temp.v('rp'));
select is((select matches from public.get_badge_counts()), 0, 'reading the chat clears it');
reset role;
select is(pg_temp.mismatches(), '', 'after reading: matches the four RPCs');

---------------------------------------------------------------------------
-- Groups: a request, an invite, an approval
---------------------------------------------------------------------------
select pg_temp.login_as(3);
insert into t select 'g', public.create_group(pg_temp.garba(), 'Saturday', null, current_date + 3, null, 4) ->> 'group_id';
select pg_temp.login_as(5);
select public.request_join(pg_temp.v('g'));
select pg_temp.login_as(3);
select public.invite_to_group(pg_temp.v('g'), pg_temp.uid(4));
select is((select matches from public.get_badge_counts()), 1, 'group admin: someone is asking to join');
select pg_temp.login_as(4);
select is((select likes from public.get_badge_counts()), 1, 'Arjun: the group invite counts as a like');
reset role;
select is(pg_temp.mismatches(), '', 'request and invite: matches the four RPCs');

select pg_temp.login_as(3);
select public.respond_join_request(pg_temp.v('g'), pg_temp.uid(5), true);
select pg_temp.login_as(5);
select is((select matches from public.get_badge_counts()), 1, 'Meera: new group');
select pg_temp.login_as(4);
select public.respond_invite(pg_temp.v('g'), true);
reset role;
select is(pg_temp.mismatches(), '', 'after approval and accepting: matches the four RPCs');

---------------------------------------------------------------------------
-- Blocks hide likes and matches
---------------------------------------------------------------------------
select pg_temp.login_as(3);
select public.send_message(pg_temp.v('rp'), 'Still there?');
select pg_temp.login_as(2);
select is((select matches from public.get_badge_counts()), 1, 'Rohan has an unread chat again');
select public.block_user(pg_temp.uid(3));
select is((select matches from public.get_badge_counts()), 0, 'blocking Priya hides the chat from Rohan''s count');
reset role;
select is(pg_temp.mismatches(), '', 'after a block: matches the four RPCs');

select * from finish();
rollback;
