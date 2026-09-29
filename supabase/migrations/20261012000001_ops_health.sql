-- KOL-03: background jobs could fail without anyone noticing. Missing Vault
-- secrets make private.call_edge_function only raise a warning and return
-- (cron still reports "succeeded"), and the email_outbox dispatch trigger
-- returns silently, so approval emails never send and cleanup-videos never
-- runs. admin_metrics now carries a `health` object that the admin Metrics
-- page turns into a banner. The jobs themselves are unchanged.
--
-- Only booleans, counts and timestamps are returned, never a secret value.
-- The checks live in their own function that catches errors, so a problem
-- reading cron or Vault (for example missing privileges on some environment)
-- shows up as `{"error": true}` instead of breaking the whole Metrics page.
create function private.ops_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  has_url boolean;
  has_secret boolean;
begin
  -- The two names private.call_edge_function and private.dispatch_email read.
  select exists (select 1 from vault.decrypted_secrets where name = 'send_email_url') into has_url;
  select exists (select 1 from vault.decrypted_secrets where name = 'email_hook_secret') into has_secret;

  return jsonb_build_object(
    'vault_secrets_present', has_url and has_secret,
    'vault_secrets', jsonb_build_object('send_email_url', has_url, 'email_hook_secret', has_secret),

    -- Not sent 30 minutes after queuing, and rows the send-email function gave
    -- up on (it sets status = 'failed' when a row reaches its attempt limit).
    'outbox_pending_over_30min', (
      select count(*) from public.email_outbox
      where status = 'pending' and created_at < now() - interval '30 minutes'
    ),
    'outbox_failed', (select count(*) from public.email_outbox where status = 'failed'),

    -- Last run and last success per job. A job that has never run (or doesn't
    -- exist) has nulls.
    'cron', (
      select jsonb_object_agg(j.name, jsonb_build_object(
        'last_run',     (select d.start_time from cron.job_run_details d
                         where d.jobid = cj.jobid order by d.start_time desc limit 1),
        'last_status',  (select d.status from cron.job_run_details d
                         where d.jobid = cj.jobid order by d.start_time desc limit 1),
        'last_success', (select max(d.start_time) from cron.job_run_details d
                         where d.jobid = cj.jobid and d.status = 'succeeded')
      ))
      from unnest(array['cleanup-videos', 'retry-emails', 'prune-profile-views']) as j(name)
      left join cron.job cj on cj.jobname = j.name
    ),

    -- Overdue for deletion by more than 2 hours. cleanup-videos runs once an
    -- hour, so a shorter overdue time is normal (now.videos_awaiting_cleanup
    -- keeps the exact count).
    'videos_past_retention', (
      select count(*) from public.verification_videos
      where deleted_at is null and delete_after < now() - interval '2 hours'
    )
  );
exception when others then
  return jsonb_build_object('error', true);
end;
$$;

revoke all on function private.ops_health() from public;

-- Same as before, plus the health key.
create or replace function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin();
  return jsonb_build_object(
    'generated_at', now(),
    'funnel', (
      select jsonb_agg(jsonb_build_object(
          'name', f.name,
          'users', (select count(distinct coalesce(e.user_id, e.id)) from public.events_log e where e.name = f.name),
          'events', (select count(*) from public.events_log e where e.name = f.name),
          'last_24h', (select count(*) from public.events_log e where e.name = f.name and e.created_at > now() - interval '24 hours')
        ) order by f.ord)
      from unnest(array[
        'signup', 'onboarding_complete', 'video_submitted', 'verified', 'first_like', 'first_match',
        'chat_cap_reached', 'group_created', 'group_joined'
      ]) with ordinality as f(name, ord)
    ),
    'votes', coalesce((
      select jsonb_agg(jsonb_build_object('activity', a.name, 'votes', v.n, 'signed_in', v.signed_in) order by v.n desc)
      from (
        select e.props ->> 'activity' as slug, count(*) as n, count(distinct e.user_id) as signed_in
        from public.events_log e where e.name = 'coming_soon_vote'
        group by 1
      ) v
      join public.activities a on a.slug = v.slug
    ), '[]'::jsonb),
    'now', jsonb_build_object(
      'profiles',          (select count(*) from public.profiles),
      'approved',          (select count(*) from public.profiles where verification_status = 'approved' and not is_banned),
      'pending_review',    (select count(*) from public.verification_videos where status = 'pending'),
      'oldest_pending',    (select min(created_at) from public.verification_videos where status = 'pending'),
      'open_reports',      (select count(*) from public.reports where status <> 'resolved'),
      'banned',            (select count(*) from public.profiles where is_banned),
      'matches',           (select count(*) from public.matches),
      'open_groups',       (select count(*) from public.groups where status in ('open', 'full')),
      'messages_24h',      (select count(*) from public.messages where created_at > now() - interval '24 hours'),
      'videos_awaiting_cleanup', (select count(*) from public.verification_videos
                                  where deleted_at is null and delete_after < now())
    ),
    'health', private.ops_health()
  );
end;
$$;
