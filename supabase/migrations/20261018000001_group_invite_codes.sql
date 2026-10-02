-- Group invite codes: alongside the link, every group's invite has a 6-character
-- code (e.g. K7QX2M) that people can type in the app to join.
--
-- The code is the same invite as the link, just shorter: it resolves to the
-- link's token and the app opens /join/<token>, so everything after that
-- (preview, sign-up and verification first, asking to join, the admin
-- approving) is unchanged. "Make a new link" replaces both.
--
-- Codes use 32 characters (A-Z and 2-9 without I, O, 0 and 1, which are easy
-- to mix up), so there are about a billion of them. Typing one needs a
-- sign-in, and each person gets 10 wrong codes an hour, so they can't be
-- guessed by trying lots.
--
-- Error codes: KL006 too many wrong invite codes.
--
-- This migration was applied to the hosted project directly before it was in
-- the repo (version 20261018000001). The file is the same SQL, so a fresh
-- database ends up identical to the hosted one.

-- 6 characters from crypto-random bytes. 256 is a multiple of 32, so every
-- character is equally likely.
create function private.new_invite_code() returns text
language sql volatile set search_path = '' as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', get_byte(b, i) % 32 + 1, 1), '' order by i)
  from (select extensions.gen_random_bytes(6) as b) r, generate_series(0, 5) i;
$$;

-- A code no other group has.
create function private.unique_invite_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  c text;
begin
  loop
    c := private.new_invite_code();
    exit when not exists (select 1 from public.group_invite_links where code = c);
  end loop;
  return c;
end;
$$;

alter table public.group_invite_links add column code text;

update public.group_invite_links set code = private.unique_invite_code();

alter table public.group_invite_links
  alter column code set not null,
  alter column code set default private.unique_invite_code(),
  add constraint group_invite_links_code_key unique (code),
  add constraint group_invite_links_code_check check (code ~ '^[A-HJ-NP-Z2-9]{6}$');

---------------------------------------------------------------------------
-- The admin's link and code
---------------------------------------------------------------------------
-- Both now return {token, code} instead of the token alone.
drop function public.get_group_invite_link(uuid);
drop function public.reset_group_invite_link(uuid);

-- Created on first use. Admin only.
create function public.get_group_invite_link(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
  l public.group_invite_links;
begin
  perform private.require_group_admin(g.id, uid);
  if g.status = 'closed' then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  insert into public.group_invite_links (group_id, token)
  values (g.id, private.new_invite_token())
  on conflict (group_id) do nothing;
  select * into l from public.group_invite_links where group_id = g.id;
  return jsonb_build_object('token', l.token, 'code', l.code);
end;
$$;

-- New token and code, so the old link and code stop working. Admin only.
create function public.reset_group_invite_link(p_group_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := private.require_approved();
  g public.groups := private.lock_group(p_group_id);
  l public.group_invite_links;
begin
  perform private.require_group_admin(g.id, uid);
  if g.status = 'closed' then
    raise exception 'This group is no longer available' using errcode = '22023';
  end if;
  insert into public.group_invite_links (group_id, token)
  values (g.id, private.new_invite_token())
  on conflict (group_id) do update
    set token = excluded.token, code = private.unique_invite_code(), created_at = now()
  returning * into l;
  return jsonb_build_object('token', l.token, 'code', l.code);
end;
$$;

---------------------------------------------------------------------------
-- Typing a code
---------------------------------------------------------------------------
-- Returns the link token for /join/<token>, or null if no group has this
-- code. Spaces, dashes and lower case are fine. Any signed-in person can use
-- it, verified or not, like the link.
create function public.find_invite_code(p_code text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  uid uuid := private.require_not_banned();
  c text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  tok text;
begin
  -- One at a time per person, so the hourly count holds.
  perform pg_advisory_xact_lock(hashtextextended('invite-code:' || uid::text, 0));
  if (select count(*) from public.events_log
      where user_id = uid and name = 'invite_code_miss' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Too many wrong codes. Try again in an hour, or ask for the invite link.' using errcode = 'KL006';
  end if;

  select l.token into tok
  from public.group_invite_links l
  join public.groups g on g.id = l.group_id
  where l.code = c and g.status <> 'closed';

  -- Not raised, so the miss is kept.
  if tok is null then
    insert into public.events_log (user_id, name) values (uid, 'invite_code_miss');
  end if;
  return tok;
end;
$$;

---------------------------------------------------------------------------
-- Grants
---------------------------------------------------------------------------
revoke all on function private.new_invite_code(), private.unique_invite_code() from public;
grant execute on function
  public.get_group_invite_link(uuid),
  public.reset_group_invite_link(uuid),
  public.find_invite_code(text)
to authenticated;
