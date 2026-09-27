-- About you (intro + up to 3 answers) and admin re-checks of photos added
-- after verification.
--
-- Seed users: 01 Ananya (admin), 02 Rohan, 03 Priya, 13 Karan (pending),
-- 21 Pooja (onboarded, no video).

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

select plan(27);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
create function pg_temp.ans(k1 text, a1 text) returns jsonb language sql immutable as $$
  select jsonb_build_array(jsonb_build_object('prompt_key', k1, 'answer', a1));
$$;
create function pg_temp.photo_count(n int) returns int language sql stable security definer as $$
  select count(*)::int from public.photos where user_id = pg_temp.uid(n);
$$;
create function pg_temp.photo_decisions() returns int language sql stable security definer as $$
  select count(*)::int from public.admin_access_log where action in ('keep_photo', 'remove_photo');
$$;
grant execute on all functions in schema pg_temp to authenticated;

---------------------------------------------------------------------------
-- Prompts
---------------------------------------------------------------------------
select is((select count(*)::int from public.prompts where active), 20, '20 questions to choose from');

---------------------------------------------------------------------------
-- save_about
---------------------------------------------------------------------------
select pg_temp.login_as(2);
select throws_ok($$update public.profiles set bio = 'direct' where id = pg_temp.uid(2)$$, '42501', null,
                 'intro can''t be written directly');
select throws_ok($$select public.save_about('hi', '[]')$$, '22023', null, 'intro needs at least 10 characters');
select throws_ok($$select public.save_about(repeat('a', 501), '[]')$$, '22023', null, 'intro max 500 characters');
select throws_ok($$select public.save_about('Find me at instagram.com/rohan', '[]')$$, '22023', null, 'no links in the intro');
select throws_ok($$select public.save_about('I build bridges for a living.',
                   '[{"prompt_key":"weekend","answer":"a"},{"prompt_key":"learning","answer":"b"},
                     {"prompt_key":"geek_out","answer":"c"},{"prompt_key":"best_food","answer":"d"}]')$$,
                 '22023', null, 'at most 3 answers');
select throws_ok($$select public.save_about('I build bridges for a living.',
                   '[{"prompt_key":"weekend","answer":"a"},{"prompt_key":"weekend","answer":"b"}]')$$,
                 '22023', null, 'same question twice rejected');
select throws_ok($$select public.save_about('I build bridges for a living.', pg_temp.ans('made_up', 'x'))$$,
                 '22023', null, 'unknown question rejected');
select throws_ok($$select public.save_about('I build bridges for a living.', pg_temp.ans('weekend', '   '))$$,
                 '22023', null, 'blank answer rejected');
select throws_ok($$select public.save_about('I build bridges for a living.', pg_temp.ans('weekend', repeat('a', 201)))$$,
                 '22023', null, 'answer max 200 characters');
select throws_ok($$select public.save_about('I build bridges for a living.', pg_temp.ans('weekend', 'see www.me.com'))$$,
                 '22023', null, 'no links in answers');

select lives_ok($$select public.save_about('  Civil engineer. I love long walks and loud music.  ',
                  '[{"prompt_key":"weekend","answer":" Cubbon Park runs "},{"prompt_key":"go_to_song","answer":"Chogada"}]')$$,
                'intro with 2 answers saves');
select is((select bio from public.profiles where id = pg_temp.uid(2)), 'Civil engineer. I love long walks and loud music.',
          'intro is trimmed');
select is((select array_agg(prompt_key || '=' || answer order by position) from public.profile_answers where user_id = pg_temp.uid(2)),
          '{"weekend=Cubbon Park runs",go_to_song=Chogada}', 'answers saved trimmed, in order');
select lives_ok($$select public.save_about('Civil engineer. I love long walks.', pg_temp.ans('learning', 'Guitar'))$$,
                'saving again replaces the answers');
select is((select count(*)::int from public.profile_answers where user_id = pg_temp.uid(2)), 1, 'old answers are gone');

select pg_temp.login_as(3);
select is((select answer from public.profile_answers where user_id = pg_temp.uid(2)), 'Guitar',
          'other verified users can read answers');
select pg_temp.login_as(13);
select is((select count(*)::int from public.profile_answers where user_id = pg_temp.uid(2)), 0,
          'unverified users can''t read answers of profiles their feed hasn''t served');

---------------------------------------------------------------------------
-- complete_onboarding needs the intro
---------------------------------------------------------------------------
reset role;
update public.profiles set onboarding_complete = false, bio = null where id = pg_temp.uid(21);
select pg_temp.login_as(21);
select throws_ok($$select public.complete_onboarding()$$, '22023', 'Please tell people a little about yourself',
                 'onboarding can''t finish without an intro');
select public.save_about('Designer who loves Garba.', '[]');
select lives_ok($$select public.complete_onboarding()$$, 'finishes once the intro is there (questions optional)');

---------------------------------------------------------------------------
-- Photos added after verification are re-checked by admins
---------------------------------------------------------------------------
select pg_temp.login_as(2);
insert into public.photos (user_id, storage_path, position) values (pg_temp.uid(2), pg_temp.uid(2) || '/new.jpg', 2);
select throws_ok($$select * from public.admin_new_photos()$$, '42501', null, 'new-photo list is admin only');

select pg_temp.login_as(1);
select is((select array_agg(storage_path) from public.admin_new_photos()), array[pg_temp.uid(2) || '/new.jpg'],
          'only photos added after verification are listed');
select is((select cardinality(verified_paths) from public.admin_new_photos()), 2, 'with the verified photos to compare');

-- Removing can go below the 2-photo minimum: take one of Rohan's first.
select public.admin_review_photo((select id from public.photos where storage_path = pg_temp.uid(2) || '/new.jpg'), false);
select is(pg_temp.photo_count(2), 2, 'removed photo is gone');
reset role;
insert into public.photos (user_id, storage_path, position, created_at)
values (pg_temp.uid(2), pg_temp.uid(2) || '/new2.jpg', 3, now() + interval '1 minute');
select pg_temp.login_as(1);
select is(public.admin_review_photo((select id from public.photos where storage_path = pg_temp.uid(2) || '/new2.jpg'), true),
          null, 'keep marks it checked');
select is((select count(*)::int from public.admin_new_photos()), 0, 'checked photos leave the list');
select is(pg_temp.photo_decisions(), 2,
          'photo decisions are logged');

select * from finish();
rollback;
