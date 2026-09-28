-- KOL-07: gender, dob and first_name (full_name) were directly writable by
-- `authenticated` and unchecked in save_basics, so an already-approved user
-- could change them with no review (e.g. flip gender and show up in a
-- different discovery pool). Lock them once verification_status = 'approved'.
-- seeking/gender_preference stay editable any time via update_preferences.
--
-- Error codes: KL003 profile locked after verification.

-- Undo the original column-level grant (20260926000002_rls.sql), plus a
-- table-level revoke as a catch-all: no client write path to profiles
-- should remain. All existing writes already go through SECURITY DEFINER
-- RPCs, which run as the function owner and don't need this grant.
revoke update (first_name, dob, gender, gender_preference, seeking, bio)
  on public.profiles from authenticated;
revoke update on public.profiles from authenticated;

-- Same signature as the current version, so its EXECUTE grant is kept.
create or replace function public.save_basics(
  p_full_name text,
  p_dob date,
  p_gender public.gender,
  p_seeking public.seeking,
  p_gender_preference public.gender[],
  p_consent boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
  v_full text := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  v_first text := split_part(v_full, ' ', 1);
  v_status public.verification_status;
  v_current_gender public.gender;
  v_current_dob date;
  v_current_first_name text;
  v_current_full_name text;
begin
  select verification_status, gender, dob, first_name
    into v_status, v_current_gender, v_current_dob, v_current_first_name
    from public.profiles where id = uid;

  select full_name into v_current_full_name
    from public.profile_private where user_id = uid;

  if char_length(v_full) not between 1 and 80 then
    raise exception 'Please enter your full name (up to 80 characters)' using errcode = '22023';
  end if;
  if v_full ~ '[0-9@_/\\]' then
    raise exception 'Please enter your name as it appears on your ID' using errcode = '22023';
  end if;
  if char_length(v_first) > 50 then
    raise exception 'Please check your first name (up to 50 characters)' using errcode = '22023';
  end if;
  if p_dob is null or p_dob > current_date - interval '18 years' then
    raise exception 'You must be 18 or older to use Kollide' using errcode = '22023';
  end if;
  if p_dob < current_date - interval '100 years' then
    raise exception 'Please check your date of birth' using errcode = '22023';
  end if;
  if p_gender is null or p_seeking is null then
    raise exception 'Please choose your gender and what you''re looking for' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_gender_preference), 0) = 0 then
    raise exception 'Please choose who you''d like to meet' using errcode = '22023';
  end if;
  if not coalesce(p_consent, false)
     and (select consent_at from public.profiles where id = uid) is null then
    raise exception 'Please accept the Privacy Policy and Terms to continue' using errcode = '22023';
  end if;

  if v_status = 'approved' and (
       p_gender is distinct from v_current_gender
    or p_dob is distinct from v_current_dob
    or v_first is distinct from v_current_first_name
    or v_full is distinct from v_current_full_name
  ) then
    raise exception 'Your verified profile details are locked. Contact support if something needs to change.'
      using errcode = 'KL003';
  end if;

  update public.profiles set
    first_name        = v_first,
    dob               = p_dob,
    gender            = p_gender,
    seeking           = p_seeking,
    gender_preference = (select array_agg(distinct g) from unnest(p_gender_preference) g),
    consent_at        = coalesce(consent_at, now())
  where id = uid;

  update public.profile_private set full_name = v_full where user_id = uid;
end;
$$;
