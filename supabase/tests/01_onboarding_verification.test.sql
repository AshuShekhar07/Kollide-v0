-- Phase 1: onboarding validation, normalization, ban checks, verification
-- submit/review, access logging and queued emails.

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

select plan(43);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Fresh signups for this test (the auth trigger creates their profile rows).
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'New.User@Example.com', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'phoneban@example.com', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 'banned01@kollide.test'::text || '.alt', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000004', 'BANNED02@kollide.test', 'authenticated', 'authenticated');

select is((select email from public.profile_private where user_id = 'a0000000-0000-0000-0000-000000000001'),
          'new.user@example.com', 'signup stores the email lowercased');
select is((select count(*)::int from public.events_log
           where user_id = 'a0000000-0000-0000-0000-000000000001' and name = 'signup'),
          1, 'signup event logged');

---------------------------------------------------------------------------
-- Normalization
---------------------------------------------------------------------------
select is(private.normalize_phone('98765 43210'), '+919876543210', 'phone: spaces');
select is(private.normalize_phone('+91-98765-43210'), '+919876543210', 'phone: +91 with dashes');
select is(private.normalize_phone('09876543210'), '+919876543210', 'phone: leading 0');
select is(private.normalize_phone('12345'), null, 'phone: too short is invalid');
select is(private.normalize_phone('5876543210'), null, 'phone: must start 6-9');
select is(private.normalize_handle('  @Rohan.Garba '), 'rohan.garba', 'handle: @, case, spaces');
select is(private.normalize_handle('https://www.instagram.com/Rohan_X/'), 'rohan_x', 'handle: profile URL');

---------------------------------------------------------------------------
-- Basics
---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');

select throws_ok($$select public.save_basics('Asha', (current_date - interval '17 years')::date, 'woman', 'friend', '{man}', true)$$,
                 '22023', 'You must be 18 or older to use Kollide', 'under-18 rejected');
select throws_ok($$select public.save_basics('Asha', '2000-01-01', 'woman', 'friend', '{man}', false)$$,
                 '22023', null, 'consent required');
select lives_ok($$select public.save_basics('  Asha ', '2000-01-01', 'woman', 'friend', '{man,man,woman}', true)$$,
                'valid basics saved');
select is((select first_name from public.profiles where id = auth.uid()), 'Asha', 'first name trimmed');
select isnt((select consent_at from public.profiles where id = auth.uid()), null, 'consent timestamp stored');

---------------------------------------------------------------------------
-- Contact
---------------------------------------------------------------------------
select throws_ok($$select public.save_contact('12345', '{"instagram":"asha"}')$$,
                 '22023', null, 'invalid phone rejected');
select throws_ok($$select public.save_contact('9876543210', '{}')$$,
                 '22023', 'Please add at least one social handle', 'at least one social required');
select throws_ok($$select public.save_contact('9876543210', '{"instagram":"bad handle!"}')$$,
                 '22023', null, 'invalid handle rejected');
select lives_ok($$select public.save_contact('98765 43210', '{"instagram":"@Asha.Dances","whatsapp":"+91 98765 43210","telegram":""}')$$,
                'valid contact saved');
select is((select socials from public.profile_private where user_id = auth.uid()),
          '{"instagram":"asha.dances","whatsapp":"+919876543210"}'::jsonb, 'socials normalized, blanks dropped');

---------------------------------------------------------------------------
-- complete_onboarding
---------------------------------------------------------------------------
select throws_ok('select public.complete_onboarding()', '22023', 'Please add at least 2 photos',
                 'needs 2 photos');

insert into public.photos (user_id, storage_path, position) values
  (auth.uid(), auth.uid() || '/p0.jpg', 0),
  (auth.uid(), auth.uid() || '/p1.jpg', 1);

select throws_ok('select public.complete_onboarding()', '22023', 'Please pick at least one activity',
                 'needs an activity');

insert into public.user_activities (user_id, activity_id)
select auth.uid(), id from public.activities where slug = 'garba';

select lives_ok('select public.complete_onboarding()', 'onboarding completes');
select ok((select onboarding_complete from public.profiles where id = auth.uid()), 'flag set');

select lives_ok($$select public.reorder_photos(array(
                   select id from public.photos where user_id = auth.uid() order by position desc))$$,
                'photos can be reordered (positions swap)');
select throws_ok($$delete from public.photos where user_id = auth.uid() and position = 0$$,
                 '22023', 'You need at least 2 photos', 'cannot drop below 2 photos once onboarded');

reset role;

select is((select template from public.email_outbox where user_id = 'a0000000-0000-0000-0000-000000000001'),
          'account_shared', 'account-details email queued');

---------------------------------------------------------------------------
-- Ban checks: phone and email matches are refused with a generic error
---------------------------------------------------------------------------
create function pg_temp.fill_profile(uid uuid, phone text, socials jsonb) returns void language plpgsql as $$
begin
  perform pg_temp.login_as(uid);
  perform public.save_basics('Test', '1999-05-05', 'man', 'partner', '{woman}', true);
  perform public.save_contact(phone, socials);
  insert into public.photos (user_id, storage_path, position) values
    (uid, uid || '/p0.jpg', 0), (uid, uid || '/p1.jpg', 1);
  insert into public.user_activities (user_id, activity_id)
  select uid, id from public.activities where slug = 'garba';
end;
$$;

select pg_temp.fill_profile('a0000000-0000-0000-0000-000000000002', '98000 00018', '{"instagram":"someone_new"}');
select throws_ok('select public.complete_onboarding()', 'KL001', null, 'banned phone cannot complete onboarding');
reset role;

select pg_temp.fill_profile('a0000000-0000-0000-0000-000000000003', '9123456789', '{"instagram":"@BANNED01"}');
select throws_ok('select public.complete_onboarding()', 'KL001', null, 'banned social handle cannot complete onboarding');
reset role;

select pg_temp.fill_profile('a0000000-0000-0000-0000-000000000004', '9123456780', '{"snapchat":"fresh_face"}');
select throws_ok('select public.complete_onboarding()', 'KL001', null, 'banned email (any case) cannot complete onboarding');
reset role;

---------------------------------------------------------------------------
-- submit_verification
---------------------------------------------------------------------------
select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
select throws_ok($$select public.submit_verification('someone-else/x.webm')$$, '22023', 'Invalid video path',
                 'path must be in the caller''s folder');
select throws_ok($$select public.submit_verification('a0000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.webm')$$,
                 '22023', 'Video upload not found, please record again', 'file must exist in storage');
reset role;

insert into storage.objects (bucket_id, name)
values ('verification-videos', 'a0000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.webm');

select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
select lives_ok($$select public.submit_verification('a0000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.webm')$$,
                'video submitted');
select throws_ok($$select public.submit_verification('a0000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.webm')$$,
                 '22023', 'Your video is already being reviewed', 'only one pending video');
select throws_ok('select * from public.admin_verification_queue()', '42501', null, 'queue is admin-only');
select throws_ok($$select public.admin_review_verification('a0000000-0000-0000-0000-000000000001', true)$$,
                 '42501', null, 'non-admin cannot review');
reset role;

---------------------------------------------------------------------------
-- Admin review
---------------------------------------------------------------------------
select pg_temp.login_as('00000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.admin_verification_queue()), 4,
          'admin sees 3 seeded + 1 new pending video');
select throws_ok($$select public.admin_review_verification('a0000000-0000-0000-0000-000000000001', false, '  ')$$,
                 '22023', 'Please give a reason for rejecting', 'rejection needs a reason');
select lives_ok($$select public.admin_review_verification('a0000000-0000-0000-0000-000000000001', true)$$,
                'admin approves');
select lives_ok($$select public.admin_review_verification('00000000-0000-0000-0000-000000000013', false, 'Face not visible')$$,
                'admin rejects');
reset role;

select results_eq(
  $$select p.verification_status::text, v.status::text,
           v.delete_after between now() + interval '47 hours' and now() + interval '49 hours'
    from public.profiles p join public.verification_videos v on v.user_id = p.id
    where p.id = 'a0000000-0000-0000-0000-000000000001'$$,
  $$values ('approved', 'approved', true)$$,
  'approval updates profile + video and schedules deletion in 48h');

select ok((select delete_after between now() + interval '29 days' and now() + interval '31 days'
           from public.verification_videos
           where user_id = '00000000-0000-0000-0000-000000000013' and status = 'rejected'),
          'rejection schedules deletion in 30 days');

select is((select count(*)::int from public.admin_access_log
           where admin_id = '00000000-0000-0000-0000-000000000001' and action = 'review_verification'),
          2, 'each review is logged');

select results_eq(
  $$select template from public.email_outbox
    where user_id in ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013')
      and template like 'verification_%' order by template$$,
  $$values ('verification_approved'), ('verification_rejected')$$,
  'result emails queued');

select * from finish();
rollback;
