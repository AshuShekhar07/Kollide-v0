-- Phase 5: scheduled jobs, coming-soon votes, settings (blocked list),
-- admin metrics and bans list (PLAN.md §5.7, §6.1, §7 Phase 5).

create extension if not exists pg_cron;

---------------------------------------------------------------------------
-- Scheduled jobs (§5.7). Edge functions are reached through the same Vault
-- secrets the email trigger uses: send_email_url (its base is the functions
-- URL) and email_hook_secret (sent as x-kollide-secret). If either is
-- missing, the call is skipped and the job does nothing.
--
-- No job here touches reports, their snapshots, or conversations: retained
-- conversations are never deleted by anything.
---------------------------------------------------------------------------
create function private.call_edge_function(fn text, body jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  base text;
  secret text;
begin
  select regexp_replace(decrypted_secret, '/send-email/?$', '') into base
  from vault.decrypted_secrets where name = 'send_email_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'email_hook_secret';
  if base is null or secret is null then
    raise warning 'edge function % not called: Vault secrets missing', fn;
    return;
  end if;

  perform net.http_post(
    url     := base || '/' || fn,
    body    := body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-kollide-secret', secret)
  );
end;
$$;

-- Hourly: delete verification video files past their delete_after.
select cron.schedule('cleanup-videos', '7 * * * *', $$select private.call_edge_function('cleanup-videos')$$);

-- Daily: profile_views only matters for today and yesterday (§2.2 view limit).
select cron.schedule('prune-profile-views', '30 21 * * *',
  $$delete from public.profile_views where viewed_on < current_date - 2$$);

-- Every 15 minutes: retry emails whose first delivery failed (send-email
-- drains pending rows when called with an empty body).
select cron.schedule('retry-emails', '*/15 * * * *', $$
  select private.call_edge_function('send-email')
  where exists (select 1 from public.email_outbox where status = 'pending' and created_at < now() - interval '5 minutes')
$$);

---------------------------------------------------------------------------
-- Account deletion: an unreviewed video has no delete_after yet, so give it
-- one now and the next cleanup removes the file. Reviewed videos keep their
-- schedule (48 hours approved, 30 days rejected).
---------------------------------------------------------------------------
create function private.expire_videos_on_delete() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.verification_videos set delete_after = now()
  where user_id = old.id and deleted_at is null and delete_after is null;
  return old;
end;
$$;

create trigger profiles_expire_videos
  before delete on public.profiles
  for each row execute function private.expire_videos_on_delete();

---------------------------------------------------------------------------
-- Landing page "I'd want this" votes (§6.1). Anyone can vote; signed-in
-- votes carry the user id. One vote per signed-in user per activity.
---------------------------------------------------------------------------
create function public.vote_coming_soon(p_slug text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if not exists (select 1 from public.activities where slug = p_slug and status = 'coming_soon') then
    raise exception 'That activity isn''t open for votes' using errcode = '22023';
  end if;
  if uid is not null and exists (
    select 1 from public.events_log
    where user_id = uid and name = 'coming_soon_vote' and props ->> 'activity' = p_slug
  ) then
    return;
  end if;
  insert into public.events_log (user_id, name, props)
  values (uid, 'coming_soon_vote', jsonb_build_object('activity', p_slug));
end;
$$;

---------------------------------------------------------------------------
-- Settings: the people you blocked, and unblock. Unblocking only lifts the
-- hiding: chats that closed stay closed and answered likes stay answered.
---------------------------------------------------------------------------
create function public.get_blocked_users()
returns table (user_id uuid, first_name text, public_code text, blocked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  return query
    select p.id, p.first_name, p.public_code::text, b.created_at
    from public.blocks b
    join public.profiles p on p.id = b.blocked_id
    where b.blocker_id = uid
    order by b.created_at desc;
end;
$$;

create function public.unblock_user(p_target_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_uid();
begin
  delete from public.blocks where blocker_id = uid and blocked_id = p_target_id;
  if not found then
    raise exception 'You haven''t blocked this person' using errcode = '22023';
  end if;
end;
$$;

---------------------------------------------------------------------------
-- Admin: funnel metrics and the bans list (§6.1)
---------------------------------------------------------------------------
-- Aggregates only; no personal data, so views aren't logged. Events whose
-- user deleted their account (user_id null) still count, once each.
create function public.admin_metrics() returns jsonb
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
    )
  );
end;
$$;

-- Banned identifiers are personal data, so every view is logged.
create function public.admin_bans()
returns table (
  id            uuid,
  kind          public.ban_kind,
  value         text,
  created_at    timestamptz,
  report_id     uuid,
  report_reason public.report_reason,
  banned_name   text,
  banned_code   text
)
language plpgsql security definer set search_path = '' as $$
declare
  admin_uid uuid := private.require_admin();
begin
  insert into public.admin_access_log (admin_id, action, target_type)
  values (admin_uid, 'view_bans', 'bans');

  return query
    select b.id, b.kind, b.value_normalized, b.created_at, b.report_id, r.reason,
           r.snapshot #>> '{reported,first_name}', r.snapshot #>> '{reported,public_code}'
    from public.bans b
    left join public.reports r on r.id = b.report_id
    order by b.created_at desc;
end;
$$;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function
  private.call_edge_function(text, jsonb),
  private.expire_videos_on_delete()
from public;

grant execute on function public.vote_coming_soon(text) to anon, authenticated;
grant execute on function
  public.get_blocked_users(),
  public.unblock_user(uuid),
  public.admin_metrics(),
  public.admin_bans()
to authenticated;
