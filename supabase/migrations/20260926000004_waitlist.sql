-- Pre-launch waitlist (PLAN.md Phase 0, step 7). Not part of §4.1; collected
-- from the landing page before accounts exist. No client can read it.

create table public.waitlist (
  email      text primary key check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

create function public.join_waitlist(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  normalized text := lower(btrim(p_email));
begin
  if normalized is null or normalized !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(normalized) > 254 then
    raise exception 'Please enter a valid email address' using errcode = '22023';
  end if;

  insert into public.waitlist (email) values (normalized)
  on conflict (email) do nothing;

  insert into public.events_log (user_id, name, props)
  values (auth.uid(), 'waitlist_join', '{}'::jsonb);
end;
$$;

grant execute on function public.join_waitlist(text) to anon, authenticated;
