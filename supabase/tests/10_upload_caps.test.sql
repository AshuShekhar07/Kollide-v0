-- KOL-04: per-user object caps on the storage buckets (photos 12, videos 3),
-- bucket size limits, deleting own unreferenced video uploads, and the
-- query behind the orphan sweep.
--
-- Seed users used here (see seed.sql): 02 Rohan (approved), 03 Priya
-- (approved), 16 Rahul (rejected, has a video row), 20 fresh01 and 21
-- novideo01 (both unsubmitted). seed.sql creates no storage.objects rows.
-- Parallel uploads can overshoot the cap: the Storage API checks the policy
-- in a rolled-back transaction before uploading (see the migration). The
-- orphan sweep removes the excess objects, which have no row.

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

select plan(30);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
-- Runs as whoever is logged in, so the insert goes through the policies.
create function pg_temp.put(bucket text, n int, k text, ext text default 'jpg') returns void language sql as $$
  insert into storage.objects (bucket_id, name) values (bucket, pg_temp.uid(n) || '/' || k || '.' || ext);
$$;
-- Direct deletes are blocked unless this is set; the delete policy still applies.
create function pg_temp.del(bucket text, n int, k text, ext text default 'jpg') returns void language plpgsql as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = bucket and name = pg_temp.uid(n) || '/' || k || '.' || ext;
end;
$$;
-- Read as the table owner, whatever the current test role (videos have no select policy).
create function pg_temp.count_in(bucket text, n int) returns int language sql stable security definer as $$
  select count(*)::int from storage.objects where bucket_id = bucket and name like pg_temp.uid(n) || '/%';
$$;
create function pg_temp.orphans(bucket text) returns text[] language sql stable security definer as $$
  select array_agg(name order by name) from public.orphaned_storage_objects(bucket, 100);
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

---------------------------------------------------------------------------
-- Bucket size limits
---------------------------------------------------------------------------
select is((select file_size_limit from storage.buckets where id = 'photos'), 2097152::bigint, 'photos are limited to 2 MB');
select is((select file_size_limit from storage.buckets where id = 'verification-videos'), 8388608::bigint,
          'videos are limited to 8 MB');

---------------------------------------------------------------------------
-- Photos: 12 objects per folder
---------------------------------------------------------------------------
select pg_temp.login_as(20);
select lives_ok($$select pg_temp.put('photos', 20, 'p' || i) from generate_series(1, 12) i$$, '12 photo objects are allowed');
select is(pg_temp.count_in('photos', 20), 12, '...and all 12 are stored');
select throws_ok($$select pg_temp.put('photos', 20, 'p13')$$, '42501', null, 'the 13th photo object is rejected');
select lives_ok($$select pg_temp.del('photos', 20, 'p1')$$, 'a photo object can be deleted');
select lives_ok($$select pg_temp.put('photos', 20, 'p13')$$, '...and re-uploading then works');
select is(pg_temp.count_in('photos', 20), 12, 'still 12 after the swap');
select throws_ok($$select pg_temp.put('photos', 20, 'p14')$$, '42501', null, 'and the cap still holds');

select pg_temp.login_as(21);
select lives_ok($$select pg_temp.put('photos', 21, 'p1')$$, 'the cap is per user: another user is unaffected');
select throws_ok($$select pg_temp.put('photos', 20, 'intruder')$$, '42501', null, 'nobody writes into another user''s folder');
reset role;

-- Six photos plus their six thumbnails is exactly the cap.
select pg_temp.login_as(16);
select lives_ok($$select pg_temp.put('photos', 16, 'q' || i) from generate_series(1, 6) i$$, '6 photos are allowed');
select lives_ok($$select pg_temp.put('photos', 16, 'q' || i || '_t') from generate_series(1, 6) i$$, '...and their 6 thumbnails');
select throws_ok($$select pg_temp.put('photos', 16, 'q7')$$, '42501', null, 'a 13th object is rejected');
reset role;

---------------------------------------------------------------------------
-- Videos: 3 objects per folder
---------------------------------------------------------------------------
select pg_temp.login_as(20);
select lives_ok($$select pg_temp.put('verification-videos', 20, 'v' || i, 'webm') from generate_series(1, 3) i$$,
                '3 video objects are allowed');
select is(pg_temp.count_in('verification-videos', 20), 3, '...and all 3 are stored');
select throws_ok($$select pg_temp.put('verification-videos', 20, 'v4', 'webm')$$, '42501', null,
                 'the 4th video object is rejected');
select lives_ok($$select pg_temp.del('verification-videos', 20, 'v1', 'webm')$$, 'an unreferenced video upload can be deleted');
select is(pg_temp.count_in('verification-videos', 20), 2, '...and it is gone');
select lives_ok($$select pg_temp.put('verification-videos', 20, 'v4', 'webm')$$, 're-uploading then works');
reset role;

-- Someone who can't upload videos at all (approved) still can't.
select pg_temp.login_as(2);
select throws_ok($$select pg_temp.put('verification-videos', 2, 'v1', 'webm')$$, '42501', null,
                 'the existing can-upload condition still applies');
reset role;

---------------------------------------------------------------------------
-- Deleting videos: only uploads no row points at
---------------------------------------------------------------------------
-- Rahul (16) has a seeded video row; Priya (3) has an unreferenced upload.
insert into storage.objects (bucket_id, name)
values ('verification-videos', (select storage_path from public.verification_videos where user_id = pg_temp.uid(16))),
       ('verification-videos', pg_temp.uid(3) || '/loose.webm');

select pg_temp.login_as(16);
select is_empty($$select 1 from storage.objects where bucket_id = 'verification-videos'$$,
                'a submitted video is unreadable even to its owner');
select pg_temp.del('verification-videos', 16, 'seed', 'webm');
select is(pg_temp.count_in('verification-videos', 16), 1, 'a video that has a verification_videos row can''t be deleted');
select pg_temp.del('verification-videos', 3, 'loose', 'webm');
select is(pg_temp.count_in('verification-videos', 3), 1, 'nobody deletes another user''s video');
reset role;

---------------------------------------------------------------------------
-- Orphan sweep query
---------------------------------------------------------------------------
-- Aged 25 h: an orphan photo, one with a photos row (Priya's seeded photo),
-- an orphan video, one with a row that is already marked deleted (Rohan's).
insert into storage.objects (bucket_id, name, created_at) values
  ('photos', pg_temp.uid(3) || '/old-orphan.jpg', now() - interval '25 hours'),
  ('photos', pg_temp.uid(3) || '/seed-0.jpg', now() - interval '25 hours'),
  ('photos', pg_temp.uid(3) || '/young-orphan.jpg', now() - interval '2 hours'),
  -- Thumbnails (KOL-01): one beside Priya's live photo, one whose photo row is gone.
  ('photos', pg_temp.uid(3) || '/seed-0_t.jpg', now() - interval '25 hours'),
  ('photos', pg_temp.uid(3) || '/gone_t.jpg', now() - interval '25 hours'),
  ('verification-videos', pg_temp.uid(2) || '/seed.webm', now() - interval '25 hours'),
  ('verification-videos', pg_temp.uid(2) || '/old-orphan.webm', now() - interval '25 hours');
update storage.objects set created_at = now() - interval '25 hours' where name = pg_temp.uid(3) || '/loose.webm';

select is(pg_temp.orphans('photos'), array[pg_temp.uid(3) || '/gone_t.jpg', pg_temp.uid(3) || '/old-orphan.jpg'],
          'old photo objects with no row, and thumbnails whose photo is gone, are orphans');
select ok(not ((pg_temp.uid(3) || '/seed-0_t.jpg') = any (pg_temp.orphans('photos'))),
          'a thumbnail of a live photo is not an orphan');
select is(pg_temp.orphans('verification-videos'),
          array[pg_temp.uid(2) || '/old-orphan.webm', pg_temp.uid(3) || '/loose.webm'],
          'only old video objects with no row are orphans');
select throws_ok($$select * from public.orphaned_storage_objects('other', 100)$$, '22023', null, 'unknown bucket rejected');

select pg_temp.login_as(2);
select throws_ok($$select * from public.orphaned_storage_objects('photos', 100)$$, '42501', null,
                 'clients can''t list orphans');
reset role;
select ok(has_function_privilege('service_role', 'public.orphaned_storage_objects(text, int)', 'execute'),
          'the sweep function (service role) can');

select * from finish();
rollback;
