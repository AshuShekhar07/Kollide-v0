-- KOL-05: join_waitlist and vote_coming_soon can be executed by anon, and
-- the anon key is public. join_waitlist logged an events_log row on every
-- call (even for an email already on the list), vote_coming_soon only
-- deduped signed-in users, and events_log has no retention, so a script
-- could grow the database without limit.
--
--   * join_waitlist logs only when it actually added a new email
--   * anonymous votes are deduped by a sha256 of the caller's IP (first
--     x-forwarded-for address); only the hash is stored, never the address
--   * anonymous calls are capped per function per day (ANON_DAILY_EVENT_CAP
--     in app_config); over the cap they return quietly, with no error
--   * a daily job prunes events_log rows that nothing reads
--
-- The cap counts inserted events, not calls: a duplicate email or repeat
-- vote gives its slot back, so replaying one value can't use up the day's
-- allowance. Signed-in callers are not capped.

create table private.anon_rate (
  bucket text not null,
  day    date not null,
  n      int  not null default 0,
  primary key (bucket, day)
);
alter table private.anon_rate enable row level security;
-- No policies or grants: only the functions below touch it.

-- app_config is readable by anyone with the anon key, so this value is
-- visible there; hitting the cap still shows no error.
insert into public.app_config (key, value) values ('ANON_DAILY_EVENT_CAP', '2000'::jsonb)
on conflict (key) do nothing;

-- Takes one of today's anonymous slots for `p_bucket`. Returns today's date
-- if it got one, null if the cap is reached (or set to 0 or less).
create function private.take_anon_slot(p_bucket text) returns date
language plpgsql security definer set search_path = '' as $$
declare
  cap   int := coalesce((select (value #>> '{}')::int from public.app_config where key = 'ANON_DAILY_EVENT_CAP'), 2000);
  today date := current_date;
  taken int;
begin
  if cap <= 0 then
    return null;
  end if;
  insert into private.anon_rate as r (bucket, day, n) values (p_bucket, today, 1)
  on conflict (bucket, day) do update set n = r.n + 1 where r.n < cap
  returning r.n into taken;
  if taken is null then
    return null;
  end if;
  return today;
end;
$$;

create function private.release_anon_slot(p_bucket text, p_day date) returns void
language sql security definer set search_path = '' as $$
  update private.anon_rate set n = greatest(n - 1, 0) where bucket = p_bucket and day = p_day;
$$;

revoke all on function private.take_anon_slot(text), private.release_anon_slot(text, date) from public;

create or replace function public.join_waitlist(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(btrim(p_email));
  uid uuid := auth.uid();
  slot date;
  added int;
begin
  if normalized is null or normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(normalized) > 254 then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;

  if uid is null then
    slot := private.take_anon_slot('join_waitlist');
    if slot is null then
      return;
    end if;
  end if;

  insert into public.waitlist (email) values (normalized)
  on conflict (email) do nothing;
  get diagnostics added = row_count;

  if added = 0 then
    if slot is not null then
      perform private.release_anon_slot('join_waitlist', slot);
    end if;
    return;
  end if;

  insert into public.events_log (user_id, name, props)
  values (uid, 'waitlist_join', '{}'::jsonb);
end;
$$;

-- One anonymous vote per (IP hash, activity), enforced atomically.
create unique index events_log_anon_vote_once
  on public.events_log ((props ->> 'activity'), (props ->> 'ip_hash'))
  where name = 'coming_soon_vote' and props ? 'ip_hash';

create or replace function public.vote_coming_soon(p_slug text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  slot date;
  ip text;
  ip_hash text;
  added int;
begin
  if not exists (select 1 from public.activities where slug = p_slug and status = 'coming_soon') then
    raise exception 'That activity isn''t open for votes' using errcode = '22023';
  end if;

  if uid is not null then
    if exists (
      select 1 from public.events_log
      where user_id = uid and name = 'coming_soon_vote' and props ->> 'activity' = p_slug
    ) then
      return;
    end if;
    insert into public.events_log (user_id, name, props)
    values (uid, 'coming_soon_vote', jsonb_build_object('activity', p_slug));
    return;
  end if;

  slot := private.take_anon_slot('vote_coming_soon');
  if slot is null then
    return;
  end if;

  -- First address of x-forwarded-for; empty or missing means no IP dedupe,
  -- and only the daily cap limits the vote.
  ip := nullif(btrim(split_part(
    coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  if ip is null then
    insert into public.events_log (user_id, name, props)
    values (null, 'coming_soon_vote', jsonb_build_object('activity', p_slug));
    return;
  end if;

  ip_hash := encode(sha256(convert_to(ip, 'UTF8')), 'hex');
  insert into public.events_log (user_id, name, props)
  values (null, 'coming_soon_vote', jsonb_build_object('activity', p_slug, 'ip_hash', ip_hash))
  on conflict ((props ->> 'activity'), (props ->> 'ip_hash'))
    where name = 'coming_soon_vote' and props ? 'ip_hash'
  do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    perform private.release_anon_slot('vote_coming_soon', slot);
  end if;
end;
$$;

-- Retention. admin_metrics reads all-time counts of the nine funnel events
-- and of coming_soon_vote, and private.log_first relies on first_like /
-- first_match rows existing, so those are never pruned. Nothing reads
-- waitlist_join (the waitlist table is the record) or account_deleted.
-- An explicit name list, so a future event a metric starts reading is not
-- pruned by accident.
select cron.schedule('prune-events-log', '40 21 * * *', $$
  delete from public.events_log
  where name in ('waitlist_join', 'account_deleted') and created_at < now() - interval '60 days';
  delete from private.anon_rate where day < current_date - 7
$$);
