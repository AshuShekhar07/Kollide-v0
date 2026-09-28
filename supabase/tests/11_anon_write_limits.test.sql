-- KOL-05: anonymous join_waitlist / vote_coming_soon can't grow the database
-- without limit: a new email is logged once, anonymous votes are deduped by
-- a hash of the first x-forwarded-for address, anonymous writes stop quietly
-- at ANON_DAILY_EVENT_CAP per function per day, and the daily job prunes
-- only events nothing reads.
--
-- Seed users used here (see seed.sql): 01 Ananya (admin), 08 Sneha (approved).
-- 'trekking' is the coming-soon activity.

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

select plan(31);

create function pg_temp.uid(n int) returns uuid language sql immutable as $$
  select ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid;
$$;
create function pg_temp.login_as(n int) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true);
$$;
-- An anonymous caller behind a proxy that sent this x-forwarded-for (null: empty header).
create function pg_temp.as_anon(xff text default null) returns void language sql as $$
  select set_config('role', 'anon', true),
         set_config('request.jwt.claims', '{"role": "anon"}', true),
         set_config('request.headers',
           case when xff is null then '' else json_build_object('x-forwarded-for', xff)::text end, true);
$$;
-- Read as the table owner, whatever the current test role.
create function pg_temp.votes() returns int language sql stable security definer as $$
  select count(*)::int from public.events_log where name = 'coming_soon_vote' and props ->> 'activity' = 'trekking';
$$;
create function pg_temp.events(n text) returns int language sql stable security definer as $$
  select count(*)::int from public.events_log where name = n;
$$;
create function pg_temp.waitlisted() returns int language sql stable security definer as $$
  select count(*)::int from public.waitlist;
$$;
create function pg_temp.slots(b text) returns int language sql stable security definer as $$
  select coalesce(sum(n), 0)::int from private.anon_rate where bucket = b and day = current_date;
$$;
create temp table t (k text primary key, v jsonb);
grant all on t to anon, authenticated;
grant execute on all functions in schema pg_temp to anon, authenticated;

---------------------------------------------------------------------------
-- Votes: no header, then an empty header (no IP to dedupe on, only the cap applies)
---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select public.vote_coming_soon('trekking');
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 2, 'no header: recorded, no IP dedupe');
select pg_temp.as_anon();
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 3, 'empty header: recorded, no IP dedupe');

---------------------------------------------------------------------------
-- Votes: deduped by the first x-forwarded-for address
---------------------------------------------------------------------------
select pg_temp.as_anon('203.0.113.7, 10.0.0.1');
select public.vote_coming_soon('trekking');
select public.vote_coming_soon('trekking');
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 4, 'the same address votes once');
select pg_temp.as_anon('203.0.113.7, 99.9.9.9');
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 4, 'only the first address counts, later proxies are ignored');
select pg_temp.as_anon('198.51.100.9');
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 5, 'a different address counts separately');
select pg_temp.as_anon('  203.0.113.7  ');
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 5, 'surrounding spaces don''t make a new voter');
reset role;

select is((select count(*)::int from public.events_log where props::text like '%203.0.113%' or props::text like '%198.51.100%'), 0,
          'no raw IP is stored');
select is((select props ->> 'ip_hash' from public.events_log
           where name = 'coming_soon_vote' and props ->> 'ip_hash' = encode(sha256(convert_to('198.51.100.9', 'UTF8')), 'hex')),
          encode(sha256(convert_to('198.51.100.9', 'UTF8')), 'hex'), 'only the sha256 of the address is stored');

---------------------------------------------------------------------------
-- join_waitlist: one row and one event per new email
---------------------------------------------------------------------------
select pg_temp.as_anon();
select lives_ok($$select public.join_waitlist('Dup@Example.com') from generate_series(1, 50)$$, '50 duplicate calls succeed');
select is(pg_temp.events('waitlist_join'), 1, '...and add exactly one event');
select is(pg_temp.waitlisted(), 1, '...and one waitlist row');
select is(pg_temp.slots('join_waitlist'), 1, 'duplicates give their slot back');
select throws_ok($$select public.join_waitlist('not an email')$$, '22023', 'Please enter a valid email address',
                 'a bad email still raises the same error');
reset role;

---------------------------------------------------------------------------
-- The daily cap: quiet, per function, anonymous only
---------------------------------------------------------------------------
update public.app_config set value = '3'::jsonb where key = 'ANON_DAILY_EVENT_CAP';
delete from private.anon_rate;

select pg_temp.as_anon();
select lives_ok($$select public.join_waitlist('n' || i || '@example.com') from generate_series(1, 5) i$$,
                'over the cap returns quietly, without an error');
select is(pg_temp.waitlisted(), 4, 'only 3 of the 5 new emails were added');
select is(pg_temp.slots('join_waitlist'), 3, 'the counter stops at the cap');
select is(pg_temp.events('waitlist_join'), 4, 'events match the rows added');
select lives_ok($$select public.vote_coming_soon('trekking') from generate_series(1, 5)$$,
                'votes past the cap return quietly too');
select is(pg_temp.votes(), 8, 'the vote cap is separate: 3 more anonymous votes went in');
select is(pg_temp.slots('vote_coming_soon'), 3, 'the vote counter stops at the cap');
reset role;

-- Signed-in callers aren't capped.
select pg_temp.login_as(8);
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 9, 'a signed-in vote still counts with the anonymous cap reached');
select public.join_waitlist('signed@example.com');
select is(pg_temp.waitlisted(), 5, 'a signed-in join still works with the anonymous cap reached');
reset role;

update public.app_config set value = '10'::jsonb where key = 'ANON_DAILY_EVENT_CAP';
select pg_temp.as_anon();
select public.join_waitlist('after@example.com');
select is(pg_temp.waitlisted(), 6, 'raising the cap lets anonymous inserts resume');
reset role;

-- Signed-in dedupe is unchanged.
select pg_temp.login_as(8);
select public.vote_coming_soon('trekking');
select is(pg_temp.votes(), 9, 'a signed-in user still votes once per activity');
reset role;

---------------------------------------------------------------------------
-- admin_metrics and the prune job
---------------------------------------------------------------------------
select pg_temp.login_as(1);
select is((select (v ->> 'votes')::int from jsonb_array_elements(public.admin_metrics() -> 'votes') v
           where v ->> 'activity' = 'Trekking'), pg_temp.votes(), 'admin_metrics vote total matches the votes cast');
reset role;

insert into public.events_log (name, props, created_at) values
  ('waitlist_join', '{}', now() - interval '90 days'),
  ('account_deleted', '{}', now() - interval '90 days'),
  ('waitlist_join', '{}', now() - interval '10 days'),
  ('signup', '{}', now() - interval '90 days'),
  ('coming_soon_vote', '{"activity": "trekking"}', now() - interval '90 days');
select pg_temp.login_as(1);
insert into t values ('before', jsonb_build_object('funnel', public.admin_metrics() -> 'funnel',
                                                    'votes', public.admin_metrics() -> 'votes'));
reset role;

select lives_ok((select command from cron.job where jobname = 'prune-events-log'), 'the prune job runs');

select pg_temp.login_as(1);
select is(jsonb_build_object('funnel', public.admin_metrics() -> 'funnel', 'votes', public.admin_metrics() -> 'votes'),
          (select v from t where k = 'before'), 'pruning leaves admin_metrics funnel and votes unchanged');
reset role;
select is((select count(*)::int from public.events_log
           where name in ('waitlist_join', 'account_deleted') and created_at < now() - interval '60 days'), 0,
          'old waitlist_join and account_deleted events are gone');
select is((select count(*)::int from public.events_log
           where (name = 'waitlist_join' and created_at > now() - interval '11 days' and created_at < now() - interval '9 days')
              or (name in ('signup', 'coming_soon_vote') and created_at < now() - interval '60 days')), 3,
          'recent waitlist events and old funnel / vote events are kept');

---------------------------------------------------------------------------
-- No client access to the counter or its helpers
---------------------------------------------------------------------------
select pg_temp.login_as(8);
select throws_ok($$select * from private.anon_rate$$, '42501', null, 'clients can''t read the counter table');
select throws_ok($$select private.take_anon_slot('join_waitlist')$$, '42501', null, 'clients can''t take slots');
reset role;

select * from finish();
rollback;
