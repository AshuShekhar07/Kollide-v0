-- Phase 5: launch checks (PLAN.md §8). RLS and client grants across every
-- table, scheduled jobs, account-deletion video expiry, coming-soon votes,
-- blocked list and unblock, admin metrics and the logged bans list.
--
-- Real file deletion by cleanup-videos is exercised against the local stack
-- (see supabase/functions/README.md, "Testing the cleanup job").

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

select plan(27);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
create function pg_temp.votes(slug text) returns int language sql stable security definer as $$
  select count(*)::int from public.events_log where name = 'coming_soon_vote' and props ->> 'activity' = slug;
$$;
create function pg_temp.logged(act text) returns int language sql stable security definer as $$
  select count(*)::int from public.admin_access_log where action = act;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

---------------------------------------------------------------------------
-- RLS and client write access, every table (§8 Security)
---------------------------------------------------------------------------
select is((select array_agg(tablename::text order by tablename) from pg_tables
           where schemaname = 'public' and not rowsecurity), null,
          'every public table has RLS enabled');

-- Clients write directly only to these; everything else goes through RPCs.
select is(
  (select array_agg(x order by x) from (
     select table_name || '.' || privilege_type as x
     from information_schema.role_table_grants
     where table_schema = 'public' and grantee in ('anon', 'authenticated')
       and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
     union
     select table_name || '.' || column_name || '.' || privilege_type
     from information_schema.column_privileges
     where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type = 'UPDATE'
   ) g),
  array[
    'conversation_members.last_read_at.UPDATE',
    'notifications.read_at.UPDATE',
    'photos.DELETE', 'photos.INSERT', 'photos.position.UPDATE',
    'user_activities.DELETE', 'user_activities.INSERT'
  ],
  'client write grants are exactly the intended ones'
);

select is((select count(*)::int from information_schema.role_table_grants
           where table_schema = 'public' and grantee = 'anon' and privilege_type <> 'SELECT'), 0,
          'anon can''t write any table');

select ok(not exists (select 1 from storage.buckets where public), 'both storage buckets are private');

---------------------------------------------------------------------------
-- Scheduled jobs (§5.7)
---------------------------------------------------------------------------
select is((select array_agg(jobname || ' ' || schedule order by jobname) from cron.job),
          array['cleanup-videos 7 * * * *', 'prune-profile-views 30 21 * * *', 'retry-emails */15 * * * *'],
          'hourly video cleanup, daily view pruning, email retries are scheduled');
select ok(not exists (select 1 from cron.job where command ~* '(reports|conversations|messages|bans)'),
          'no job touches reports, conversations, messages or bans');
select ok(not has_function_privilege('authenticated', 'private.call_edge_function(text, jsonb)', 'execute'),
          'clients can''t trigger edge function calls');

insert into public.profile_views (viewer_id, viewed_id, viewed_on) values
  (pg_temp.uid(13), pg_temp.uid(2), current_date - 3),
  (pg_temp.uid(13), pg_temp.uid(3), current_date - 1);
select lives_ok((select command from cron.job where jobname = 'prune-profile-views'), 'prune job runs');
select is((select array_agg(viewed_id) from public.profile_views where viewer_id = pg_temp.uid(13)),
          array[pg_temp.uid(3)], 'prune keeps yesterday''s views, drops older ones');

---------------------------------------------------------------------------
-- Account deletion: unreviewed videos expire now, reviewed keep schedule
---------------------------------------------------------------------------
-- Karan (13) is pending with an unreviewed video; Rohan (2) is approved.
update public.verification_videos set delete_after = now() + interval '40 hours'
where user_id = pg_temp.uid(2);
insert into public.reports (reporter_id, reported_id, reason, details, chat_share_consent, snapshot)
values (pg_temp.uid(2), pg_temp.uid(13), 'spam', 'kept', true, '{}');
delete from auth.users where id in (pg_temp.uid(13), pg_temp.uid(2));
select ok((select delete_after <= now() from public.verification_videos where storage_path like pg_temp.uid(13) || '/%'
           and status = 'pending'), 'deleted account''s unreviewed video is due for cleanup now');
select ok((select delete_after > now() + interval '39 hours' from public.verification_videos
           where storage_path like pg_temp.uid(2) || '/%'), 'reviewed video keeps its 48h schedule');
select is((select count(*)::int from public.reports where details = 'kept'), 1, 'reports survive account deletion');

---------------------------------------------------------------------------
-- Coming-soon votes (§6.1)
---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select lives_ok($$select public.vote_coming_soon('trekking')$$, 'anyone can vote');
select throws_ok($$select public.vote_coming_soon('garba')$$, '22023', null, 'live activities can''t be voted on');
select throws_ok($$select public.vote_coming_soon('nope')$$, '22023', null, 'unknown activity rejected');
select pg_temp.login_as(8);
select public.vote_coming_soon('trekking');
select public.vote_coming_soon('trekking');
select is(pg_temp.votes('trekking'), 2, 'a signed-in user counts once per activity');

---------------------------------------------------------------------------
-- Blocked list and unblock
---------------------------------------------------------------------------
select public.block_user(pg_temp.uid(9));
select is((select array_agg(first_name) from public.get_blocked_users()), '{Isha}', 'blocked list shows who you blocked');
select lives_ok($$select public.unblock_user(pg_temp.uid(9))$$, 'unblock');
select is((select count(*)::int from public.get_blocked_users()), 0, 'list is empty after unblocking');
select throws_ok($$select public.unblock_user(pg_temp.uid(9))$$, '22023', null, 'unblocking twice fails');
select pg_temp.login_as(9);
select throws_ok($$select public.unblock_user(pg_temp.uid(8))$$, '22023', null, 'can''t lift someone else''s block');

---------------------------------------------------------------------------
-- Admin metrics and bans
---------------------------------------------------------------------------
select throws_ok($$select public.admin_metrics()$$, '42501', null, 'metrics are admin only');
select throws_ok($$select * from public.admin_bans()$$, '42501', null, 'bans list is admin only');
select pg_temp.login_as(1);
select is(jsonb_array_length(public.admin_metrics() -> 'funnel'), 9, 'metrics include all funnel steps');
select is((select (v ->> 'votes')::int from jsonb_array_elements(public.admin_metrics() -> 'votes') v
           where v ->> 'activity' = 'Trekking'), 2, 'metrics count votes per activity');
select ok((select count(*) from public.admin_bans()) >= 6, 'bans list returns the seeded bans');
select is(pg_temp.logged('view_bans'), 1, 'viewing the bans list is logged');

select * from finish();
rollback;
