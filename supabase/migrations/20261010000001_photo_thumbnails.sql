-- KOL-01: each photo now has a card thumbnail stored next to it,
-- `<uid>/<id>_t.jpg` beside `<uid>/<id>.jpg`. Only the full image has a
-- photos row, so the orphan sweep (KOL-04) would have deleted every live
-- thumbnail 24 h after upload. A thumbnail now counts as referenced while
-- its full-size photo has a row; once the photo row is gone it is swept like
-- any other orphan.
--
-- Same signature, grants and videos branch as before.
create or replace function public.orphaned_storage_objects(p_bucket text, p_limit int default 100)
returns table (name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_bucket = 'photos' then
    return query
      select o.name from storage.objects o
      where o.bucket_id = 'photos'
        and o.created_at < now() - interval '24 hours'
        and not exists (
          select 1 from public.photos p
          where p.storage_path = o.name
             or p.storage_path = regexp_replace(o.name, '_t\.jpg$', '.jpg')
        )
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
