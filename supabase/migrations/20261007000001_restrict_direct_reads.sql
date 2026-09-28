-- KOL-06: profiles_select, photos_select, user_activities_select and
-- profile_answers_select all gated SELECT with private.can_view_profile(),
-- a helper meant for RPC-mediated visibility (get_feed etc., which then
-- apply their own real filtering). Used directly as table RLS, it let any
-- approved user read every other approved user's full row straight from
-- the API -- exact dob, gender_preference, verified_by, consent_at, all
-- photos, all activities, all prompt answers -- with none of get_feed's
-- narrowing. Tighten these four to "own row, or admin", matching the idiom
-- already used by profile_private_select/verification_videos_select.
-- private.can_view_profile itself is untouched: the storage policy for
-- signed photo URLs still depends on it.

alter policy profiles_select on public.profiles
  using (id = auth.uid() or private.is_admin());

alter policy photos_select on public.photos
  using (user_id = auth.uid() or private.is_admin());

alter policy user_activities_select on public.user_activities
  using (user_id = auth.uid() or private.is_admin());

alter policy profile_answers_select on public.profile_answers
  using (user_id = auth.uid() or private.is_admin());

-- Replaces the direct profile_answers read in web/src/lib/about.ts, which
-- relied on the now-removed cross-user visibility. Same authorization rule
-- the old policy enforced (can_view_profile), same three fields the UI
-- already consumes -- no widening.
create function public.get_profile_answers(p_user_id uuid)
returns table(prompt_key text, answer text, question text)
language sql stable security definer set search_path = '' as $$
  select a.prompt_key, a.answer, p.question
  from public.profile_answers a
  join public.prompts p on p.key = a.prompt_key
  where a.user_id = p_user_id and private.can_view_profile(p_user_id)
  order by a.position;
$$;

grant execute on function public.get_profile_answers(uuid) to authenticated;
