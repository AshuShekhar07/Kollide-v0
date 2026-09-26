-- Phase 2: feed filters, unverified view limit, held likes released or
-- discarded on review, incoming likes, matches and contact reveal.
--
-- Seed users (see seed.sql), all in Garba:
--   01 Ananya  woman  [man,woman]  friend   approved (admin)
--   02 Rohan   man    [woman]      group    approved
--   03 Priya   woman  [man]        group    approved
--   04 Arjun   man    [woman]      group    approved
--   05 Meera   woman  [man]        group    approved
--   08 Sneha   woman  [woman,man]  friend   approved
--   09 Isha    woman  [woman]      friend   approved
--   10 Aditya  man    [man,woman]  friend   approved
--   11 Sam     non_binary [all]    friend   approved
--   12 Diya    woman  [man]        group    approved
--   13 Karan   man    [woman]      group    pending
--   14 Riya    woman  [man]        group    pending
--   18 Varun   banned; 21 Pooja unsubmitted; 20 fresh
-- Seeded likes: Priya→Rohan, Meera→Rohan, Aditya→Ananya (pending), Karan→Priya (held).

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

select plan(57);

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
-- First names in the caller's feed, sorted.
create function pg_temp.feed_names() returns text[] language sql as $$
  select coalesce(array_agg(x ->> 'first_name' order by x ->> 'first_name'), '{}')
  from jsonb_array_elements(public.get_feed(pg_temp.garba(), 50) -> 'profiles') x;
$$;
create function pg_temp.incoming_names() returns text[] language sql as $$
  select coalesce(array_agg(first_name order by first_name), '{}') from public.get_incoming_likes();
$$;
grant execute on all functions in schema pg_temp to authenticated;

-- Scratch space for values carried between steps.
create temp table t (k text primary key, v text);
grant all on t to authenticated;

---------------------------------------------------------------------------
-- Feed filters
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select is(pg_temp.feed_names(), '{Diya,Meera,Priya}',
          'group feed: approved women who want men; not pending/rejected/banned');
select is((select array_agg(k order by k) from jsonb_object_keys(
             public.get_feed(pg_temp.garba(), 1) -> 'profiles' -> 0) k),
          '{age,bio,first_name,gender,id,photo_paths,public_code}',
          'feed returns public fields only');
select is(public.get_feed(pg_temp.garba(), 1) -> 'views_left', 'null'::jsonb,
          'verified callers have no view limit');

select pg_temp.login_as(8);
select is(pg_temp.feed_names(), '{Aditya,Ananya,Isha}',
          'friend feed: Sam excluded (non-binary not in Sneha''s preferences)');

select pg_temp.login_as(10);
select is(pg_temp.feed_names(), '{Sneha}',
          'mutual preference: Isha only wants women, Sam is outside Aditya''s preferences (Ananya already liked)');

-- Switching "looking for" moves you to the other pool.
select pg_temp.login_as(8);
select throws_ok($$select public.update_preferences('group', '{}')$$, '22023', null,
                 'update_preferences needs at least one gender');
select lives_ok($$select public.update_preferences('group', '{woman,man}')$$, 'Sneha switches to group');
select is(pg_temp.feed_names(), '{Arjun,Rohan}', 'group feed after switching: group-seekers who want women');
select lives_ok($$select public.update_preferences('friend', '{woman,man}')$$, 'Sneha switches back');

select pg_temp.login_as(21);
select throws_ok($$select public.get_feed(pg_temp.garba(), 10)$$, '22023', null,
                 'no video submitted: no feed');
select pg_temp.login_as(20);
select throws_ok($$select public.get_feed(pg_temp.garba(), 10)$$, '22023', null,
                 'not onboarded: no feed');
select pg_temp.login_as(18);
select throws_ok($$select public.get_feed(pg_temp.garba(), 10)$$, 'KL001', null,
                 'banned: no feed');

select pg_temp.login_as(4);
select throws_ok($$select public.get_feed((select id from public.activities where slug = 'trekking'), 10)$$,
                 '22023', null, 'coming-soon activity has no feed');

reset role;
insert into public.blocks (blocker_id, blocked_id) values
  (pg_temp.uid(4), pg_temp.uid(12)),   -- Arjun blocks Diya
  (pg_temp.uid(5), pg_temp.uid(4));    -- Meera blocks Arjun
select pg_temp.login_as(4);
select is(pg_temp.feed_names(), '{Priya}', 'blocks hide people in both directions');
select throws_ok(format($$select public.like_profile(%L, pg_temp.garba())$$, pg_temp.uid(12)),
                 '22023', 'This profile is no longer available', 'cannot like someone blocked');

select lives_ok(format($$select public.pass_profile(%L, pg_temp.garba())$$, pg_temp.uid(3)), 'Arjun passes Priya');
select is(pg_temp.feed_names(), '{}', 'passed profiles leave the feed');

reset role;
update public.profiles set is_banned = true where id = pg_temp.uid(12);
select pg_temp.login_as(2);
select is(pg_temp.feed_names(), '{Meera,Priya}', 'banned users leave the feed');

---------------------------------------------------------------------------
-- Unverified daily view limit
---------------------------------------------------------------------------
reset role;
update public.app_config set value = '1' where key = 'UNVERIFIED_DAILY_VIEW_LIMIT';
select pg_temp.login_as(14);   -- Riya: candidates are Rohan and Arjun
insert into t values ('riya_feed', public.get_feed(pg_temp.garba(), 10)::text);
select is(jsonb_array_length((select v::jsonb from t where k = 'riya_feed') -> 'profiles'), 1,
          'unverified: limit caps the profiles served');
select is((select v::jsonb from t where k = 'riya_feed') -> 'views_left', '0'::jsonb, 'views_left reaches 0');
select is(public.get_feed(pg_temp.garba(), 10) -> 'profiles' -> 0 -> 'id',
          (select v::jsonb from t where k = 'riya_feed') -> 'profiles' -> 0 -> 'id',
          'profiles already served today are re-served without counting again');
insert into t values ('riya_seen', (select v::jsonb from t where k = 'riya_feed') -> 'profiles' -> 0 ->> 'id');
insert into t select 'riya_unseen', id::text from unnest(array[pg_temp.uid(2), pg_temp.uid(4)]) id
  where id::text <> (select v from t where k = 'riya_seen');
select throws_ok($$select public.like_profile((select v::uuid from t where k = 'riya_unseen'), pg_temp.garba())$$,
                 '22023', 'This profile is no longer available', 'unverified cannot like a profile they were never served');
select is(public.like_profile((select v::uuid from t where k = 'riya_seen'), pg_temp.garba()) ->> 'status', 'held',
          'unverified like is held');
reset role;
update public.app_config set value = '30' where key = 'UNVERIFIED_DAILY_VIEW_LIMIT';

select pg_temp.login_as((select right(v, 2)::int from t where k = 'riya_seen'));
select ok(not ('Riya' = any (pg_temp.incoming_names())), 'held like is invisible to the recipient');

-- Rejection discards the held like silently.
select pg_temp.login_as(1);
select lives_ok(format($$select public.admin_review_verification(%L, false, 'Face not clearly visible')$$, pg_temp.uid(14)),
                'admin rejects Riya');
reset role;
select is((select status::text from public.swipes where from_user = pg_temp.uid(14)), 'discarded',
          'rejection discards held likes');
select is((select count(*)::int from public.notifications n
           where n.type = 'like_received' and n.payload ->> 'swipe_id' in
             (select id::text from public.swipes where from_user = pg_temp.uid(14))),
          0, 'no notification for a discarded like');
select pg_temp.login_as((select right(v, 2)::int from t where k = 'riya_seen'));
select ok(not ('Riya' = any (pg_temp.incoming_names())), 'discarded like never appears');

---------------------------------------------------------------------------
-- Held → released on approval
---------------------------------------------------------------------------
select pg_temp.login_as(13);   -- Karan (pending); seeded held like to Priya
select is(pg_temp.feed_names(), '{Meera}', 'already-liked profiles (Priya) are not re-served');
select is((public.get_feed(pg_temp.garba(), 10) ->> 'views_left')::int, 29,
          'unverified: views_left counts down');
select is(public.like_profile(pg_temp.uid(3), pg_temp.garba()) ->> 'status', 'held',
          'repeat like is harmless and stays held');

select pg_temp.login_as(3);
select is(pg_temp.incoming_names(), '{}', 'Priya does not see Karan''s held like');

select pg_temp.login_as(1);
select lives_ok(format($$select public.admin_review_verification(%L, true)$$, pg_temp.uid(13)), 'admin approves Karan');

select pg_temp.login_as(3);
select is(pg_temp.incoming_names(), '{Karan}', 'after approval the like appears');
select is((select count(*)::int from public.notifications where type = 'like_received'), 1,
          'and the recipient is notified');

---------------------------------------------------------------------------
-- Responding and matching
---------------------------------------------------------------------------
insert into t select 'karan_swipe', swipe_id::text from public.get_incoming_likes() where first_name = 'Karan';

select pg_temp.login_as(4);
select throws_ok($$select public.respond_to_like((select v::uuid from t where k = 'karan_swipe'), true)$$,
                 '22023', null, 'only the recipient can respond');
select throws_ok(format($$select public.get_contact(%L)$$, pg_temp.uid(3)), '42501', null,
                 'get_contact fails for non-matched users');
select pg_temp.login_as(13);
select throws_ok(format($$select public.get_contact(%L)$$, pg_temp.uid(3)), '42501', null,
                 'a pending like does not reveal contact details');

select pg_temp.login_as(3);
select is(public.respond_to_like((select v::uuid from t where k = 'karan_swipe'), true) ->> 'matched', 'true',
          'Priya accepts Karan');
reset role;
select is((select count(*)::int from public.matches
           where user_a = pg_temp.uid(3) and user_b = pg_temp.uid(13)), 1, 'match created');
select is((select message_cap from public.conversations c join public.matches m on m.id = c.match_id
           where m.user_a = pg_temp.uid(3) and m.user_b = pg_temp.uid(13)), 100, 'direct chat cap is 100');
select is((select count(*)::int from public.conversation_members cm
           join public.conversations c on c.id = cm.conversation_id
           join public.matches m on m.id = c.match_id
           where m.user_a = pg_temp.uid(3) and m.user_b = pg_temp.uid(13)), 2, 'both are conversation members');
select is((select count(*)::int from public.notifications where user_id = pg_temp.uid(13) and type = 'match'), 1,
          'liker is notified of the match');

select pg_temp.login_as(13);
select is(public.get_contact(pg_temp.uid(3)), '{"instagram": "approved02"}'::jsonb, 'matched users see socials');
select pg_temp.login_as(3);
select is((select array_agg(first_name) from public.get_matches()), '{Karan}', 'match appears in get_matches');
select is(pg_temp.feed_names(), '{Arjun}', 'matched (Karan) and already-liked (Rohan) people leave the feed');

-- Mutual like
select pg_temp.login_as(2);
select is(public.like_profile(pg_temp.uid(5), pg_temp.garba()) ->> 'matched', 'true',
          'liking someone who already liked you matches instantly (seeded Meera → Rohan)');
select is(pg_temp.incoming_names(), '{Priya}', 'the matched like leaves incoming likes');
select is(pg_temp.feed_names(), '{Priya}', 'matched and swiped profiles leave the feed');

-- Decline is silent
reset role;
insert into t select 'priya_notes', count(*)::text from public.notifications where user_id = pg_temp.uid(3);
select pg_temp.login_as(2);
insert into t select 'priya_swipe', swipe_id::text from public.get_incoming_likes() where first_name = 'Priya';
select is(public.respond_to_like((select v::uuid from t where k = 'priya_swipe'), false) ->> 'matched', 'false',
          'Rohan declines Priya');
reset role;
select is((select count(*)::text from public.notifications where user_id = pg_temp.uid(3)),
          (select v from t where k = 'priya_notes'), 'the liker is not told about a decline');
select pg_temp.login_as(2);
select is(pg_temp.feed_names(), '{}', 'a declined liker leaves the decliner''s feed');

---------------------------------------------------------------------------
-- Blocks hide matches and contact
---------------------------------------------------------------------------
reset role;
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(3), pg_temp.uid(13));
select pg_temp.login_as(13);
select throws_ok(format($$select public.get_contact(%L)$$, pg_temp.uid(3)), '42501', null,
                 'no contact details after a block');
select is((select count(*)::int from public.get_matches()), 0, 'blocked match leaves get_matches');

---------------------------------------------------------------------------
-- No direct table access
---------------------------------------------------------------------------
select throws_ok($$select * from public.swipes$$, '42501', null, 'swipes are not readable directly');
select throws_ok(format($$insert into public.matches (user_a, user_b, activity_id) values (%L, %L, pg_temp.garba())$$,
                        pg_temp.uid(2), pg_temp.uid(13)), '42501', null, 'matches cannot be inserted directly');
select throws_ok(format($$select public.like_profile(%L, pg_temp.garba())$$, pg_temp.uid(13)),
                 '22023', null, 'cannot like yourself');

select * from finish();
rollback;
