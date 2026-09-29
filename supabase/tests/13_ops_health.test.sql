-- KOL-03: admin_metrics carries a `health` object so silent background-job
-- failures (missing Vault secrets, a stuck email outbox, a cron job that
-- stopped, videos kept past retention) are visible to admins.
--
-- Seed users used here (see seed.sql): 01 Ananya (admin), 03 Priya (approved),
-- 13 Karan and 14 Riya (pending, each with a verification video).
-- Vault secrets are changed as the default (postgres) role before any
-- login_as; everything rolls back with the test transaction.

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

select plan(17);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
-- The health object, read as the table owner whatever the current test role.
create function pg_temp.health() returns jsonb language sql stable security definer as $$
  select private.ops_health();
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

---------------------------------------------------------------------------
-- Shape: only keys were added, and it is still admin only
---------------------------------------------------------------------------
select pg_temp.login_as(1);
select is((select array_agg(k order by k) from jsonb_object_keys(public.admin_metrics()) k),
          array['funnel', 'generated_at', 'health', 'now', 'votes'],
          'admin_metrics keeps its keys and adds health');
select is((select count(*)::int from jsonb_object_keys(public.admin_metrics() -> 'now')), 10,
          'the existing now block is unchanged');
select is(public.admin_metrics() -> 'health', pg_temp.health(), 'admin_metrics returns the health checks');
select pg_temp.login_as(3);
select throws_ok($$select public.admin_metrics()$$, '42501', null, 'health is admin only');
reset role;

---------------------------------------------------------------------------
-- Vault secrets (names only, never values)
---------------------------------------------------------------------------
select is(pg_temp.health() -> 'vault_secrets_present', 'true'::jsonb, 'secrets present when both exist');
select is(pg_temp.health() -> 'vault_secrets', '{"send_email_url": true, "email_hook_secret": true}'::jsonb,
          'each secret is reported by name');

delete from vault.secrets where name = 'email_hook_secret';
select is(pg_temp.health() -> 'vault_secrets_present', 'false'::jsonb, 'a missing secret makes the check false');
select is(pg_temp.health() -> 'vault_secrets', '{"send_email_url": true, "email_hook_secret": false}'::jsonb,
          '...and says which one');
select ok(position('kong' in pg_temp.health()::text) = 0 and position('local-email-hook' in pg_temp.health()::text) = 0,
          'no secret value appears in the output');

select vault.create_secret('local-email-hook-secret', 'email_hook_secret');
select is(pg_temp.health() -> 'vault_secrets_present', 'true'::jsonb, 'restoring the secret clears it');

delete from vault.secrets where name = 'send_email_url';
select is(pg_temp.health() -> 'vault_secrets', '{"send_email_url": false, "email_hook_secret": true}'::jsonb,
          'the other secret is checked too');

---------------------------------------------------------------------------
-- Email outbox
---------------------------------------------------------------------------
create temp table t (k text primary key, v int);
insert into t values
  ('pending', (pg_temp.health() ->> 'outbox_pending_over_30min')::int),
  ('failed', (pg_temp.health() ->> 'outbox_failed')::int),
  ('videos', (pg_temp.health() ->> 'videos_past_retention')::int);

insert into public.email_outbox (to_email, template, status, attempts, created_at) values
  ('old-pending@example.test', 'new_match', 'pending', 0, now() - interval '2 hours'),
  ('young-pending@example.test', 'new_match', 'pending', 0, now() - interval '5 minutes'),
  ('old-sent@example.test', 'new_match', 'sent', 1, now() - interval '3 hours'),
  ('gave-up@example.test', 'new_match', 'failed', 3, now() - interval '3 hours');
select is((pg_temp.health() ->> 'outbox_pending_over_30min')::int, (select v from t where k = 'pending') + 1,
          'only the unsent row older than 30 minutes is counted as stuck');
select is((pg_temp.health() ->> 'outbox_failed')::int, (select v from t where k = 'failed') + 1,
          'rows that reached the attempt limit are counted as failed');

---------------------------------------------------------------------------
-- Videos past retention
---------------------------------------------------------------------------
update public.verification_videos set delete_after = now() - interval '3 hours'
where user_id = pg_temp.uid(13);
update public.verification_videos set delete_after = now() - interval '30 minutes'
where user_id = pg_temp.uid(14);
select is((pg_temp.health() ->> 'videos_past_retention')::int, (select v from t where k = 'videos') + 1,
          'a video overdue by hours counts; one overdue by minutes (the hourly job is due) does not');

---------------------------------------------------------------------------
-- Cron: last run and last success per job
---------------------------------------------------------------------------
insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
select jobid, 990001, 1, 'postgres', 'postgres', 'test', 'succeeded', 'ok', now() - interval '3 hours', now() - interval '3 hours'
from cron.job where jobname = 'cleanup-videos';
insert into cron.job_run_details (jobid, runid, job_pid, database, username, command, status, return_message, start_time, end_time)
select jobid, 990002, 1, 'postgres', 'postgres', 'test', 'failed', 'boom', now() - interval '10 minutes', now() - interval '10 minutes'
from cron.job where jobname = 'cleanup-videos';
select is((select array_agg(k order by k) from jsonb_object_keys(pg_temp.health() -> 'cron') k),
          array['cleanup-videos', 'prune-profile-views', 'retry-emails'], 'the three jobs are reported');
select is(pg_temp.health() #>> '{cron,cleanup-videos,last_status}', 'failed', 'the latest run status is shown');
select ok((pg_temp.health() #>> '{cron,cleanup-videos,last_success}')::timestamptz
            < (pg_temp.health() #>> '{cron,cleanup-videos,last_run}')::timestamptz,
          'the last success is tracked separately from the last run');

select * from finish();
rollback;
