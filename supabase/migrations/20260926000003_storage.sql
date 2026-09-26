-- Storage buckets and policies (PLAN.md §4.2). Both buckets are private:
-- files are only reachable through signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('photos', 'photos', false, 5 * 1024 * 1024,
    array['image/jpeg']),
  ('verification-videos', 'verification-videos', false, 25 * 1024 * 1024,
    array['video/webm', 'video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder names come from client-supplied paths, so validate before casting.
create function private.can_view_photo_folder(folder text) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when folder ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.can_view_profile(folder::uuid)
    else false
  end;
$$;

revoke all on function private.can_view_photo_folder(text) from public;
grant execute on function private.can_view_photo_folder(text) to authenticated;

---------------------------------------------------------------------------
-- photos: {user_id}/{uuid}.jpg
--   write: owner only
--   read:  anyone who may view the owner's profile (owner, admins, approved
--          users, and unverified users only for profiles their feed served)
---------------------------------------------------------------------------
create policy photos_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy photos_objects_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy photos_objects_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and private.can_view_photo_folder((storage.foldername(name))[1])
  );

---------------------------------------------------------------------------
-- verification-videos: {user_id}/{uuid}.webm|.mp4
--   write: owner only, and only while they have no pending/approved video
--          (first submission, or the single resubmission after a rejection)
--   read:  nobody. Admins get a 5-minute signed URL from the
--          admin-video-url edge function (service role), which logs access.
---------------------------------------------------------------------------
create function private.can_upload_verification_video() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and not p.is_banned
      and p.verification_status in ('unsubmitted', 'rejected')
  )
  and (
    select count(*) from public.verification_videos v where v.user_id = auth.uid()
  ) < 2;
$$;

revoke all on function private.can_upload_verification_video() from public;
grant execute on function private.can_upload_verification_video() to authenticated;

create policy verification_videos_objects_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
    and private.can_upload_verification_video()
  );
