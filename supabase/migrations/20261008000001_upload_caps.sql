-- KOL-04: the storage insert policies only checked the folder, and the video
-- policy counted verification_videos ROWS (which only exist after
-- submit_verification succeeds), so one account could upload unlimited files.
-- Files with no row were never deleted either, including face videos.
--
--   * cap objects per user folder: photos 12, verification-videos 3
--   * lower the bucket size limits: photos 2 MB, verification-videos 8 MB
--   * let users delete their own video objects that no row points at
--     (client cleanup after a failed submit_verification)
--   * list unreferenced objects older than 24 h for the hourly sweep
--
-- Existing retention (48 h after approval, 30 days after rejection) is
-- unchanged.

update storage.buckets set file_size_limit = 2 * 1024 * 1024 where id = 'photos';
update storage.buckets set file_size_limit = 8 * 1024 * 1024 where id = 'verification-videos';

-- Count in a SECURITY DEFINER function: verification-videos has no select
-- policy, so a plain subquery in the policy would always see zero rows.
-- WITH CHECK doesn't see the row being inserted, so `< p_max` allows the
-- p_max-th object and rejects the next.
--
-- Known limit: the Storage API runs this check in a transaction it rolls
-- back BEFORE uploading the file, and only writes the real row afterwards.
-- Uploads fired in parallel therefore all pass the check together and can
-- overshoot the cap (no lock in the policy can prevent that). The overshoot
-- is bounded by how many requests are in flight, and the excess objects have
-- no photos/verification_videos row, so the orphan sweep removes them after
-- 24 h.
create function private.can_add_storage_object(p_bucket text, p_max int) returns boolean
language sql stable security definer set search_path = '' as $$
  select (
    select count(*) from storage.objects o
    where o.bucket_id = p_bucket
      and (storage.foldername(o.name))[1] = auth.uid()::text
  ) < p_max;
$$;

-- Users only hold a column-limited select on verification_videos that
-- excludes storage_path, so the delete policy checks through this.
create function private.video_object_has_row(p_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.verification_videos where storage_path = p_name);
$$;

revoke all on function
  private.can_add_storage_object(text, int),
  private.video_object_has_row(text)
from public;
grant execute on function
  private.can_add_storage_object(text, int),
  private.video_object_has_row(text)
to authenticated;

drop policy photos_objects_insert on storage.objects;
create policy photos_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.can_add_storage_object('photos', 12)
  );

drop policy verification_videos_objects_insert on storage.objects;
create policy verification_videos_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.can_upload_verification_video()
    and private.can_add_storage_object('verification-videos', 3)
  );

-- Only an upload that never became a verification_videos row: video under
-- review or kept for retention can't be deleted by its owner. A delete
-- reads the row it removes, so it also needs a matching select policy;
-- scoped the same way, so videos under review stay unreadable to everyone
-- but admins (via the admin-video-url function).
create policy verification_videos_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not private.video_object_has_row(name)
  );

create policy verification_videos_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not private.video_object_has_row(name)
  );

-- Objects older than 24 h that no row points at. Called by the
-- sweep-orphan-uploads Edge Function (service role), which deletes them
-- through the Storage API: direct deletes on storage.objects are blocked.
create function public.orphaned_storage_objects(p_bucket text, p_limit int default 100)
returns table (name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_bucket = 'photos' then
    return query
      select o.name from storage.objects o
      where o.bucket_id = 'photos'
        and o.created_at < now() - interval '24 hours'
        and not exists (select 1 from public.photos p where p.storage_path = o.name)
      order by o.created_at
      limit p_limit;
  elsif p_bucket = 'verification-videos' then
    return query
      select o.name from storage.objects o
      where o.bucket_id = 'verification-videos'
        and o.created_at < now() - interval '24 hours'
        and not exists (select 1 from public.verification_videos v where v.storage_path = o.name)
      order by o.created_at
      limit p_limit;
  else
    raise exception 'Unknown bucket' using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.orphaned_storage_objects(text, int) from public, anon, authenticated;
grant execute on function public.orphaned_storage_objects(text, int) to service_role;

select cron.schedule('sweep-orphan-uploads', '37 * * * *',
  $$select private.call_edge_function('sweep-orphan-uploads')$$);
