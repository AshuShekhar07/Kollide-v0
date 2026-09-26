-- Kollide isn't a dating app: "looking for" is now `friend` or `group`
-- (a group of friends), replacing `partner`. The 1:1 feed still only pairs
-- people with the same choice; users can change it from their profile.

alter type public.seeking rename value 'partner' to 'group';

-- Nobody chose "group" before this change, so existing `partner` rows
-- (now `group`) become `friend`.
update public.profiles set seeking = 'friend' where seeking = 'group';

-- Change "looking for" and "who I'd like to meet" after onboarding.
create function public.update_preferences(p_seeking public.seeking, p_gender_preference public.gender[])
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  if p_seeking is null then
    raise exception 'Please choose what you''re looking for' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_gender_preference), 0) = 0 then
    raise exception 'Please choose who you''d like to meet' using errcode = '22023';
  end if;

  update public.profiles set
    seeking           = p_seeking,
    gender_preference = (select array_agg(distinct g) from unnest(p_gender_preference) g)
  where id = uid;
end;
$$;

grant execute on function public.update_preferences(public.seeking, public.gender[]) to authenticated;
