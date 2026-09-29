-- KOL-09: a health-check target for the uptime workflow. It is called through
-- the public REST API with the anon key, so it must be cheap and read nothing:
-- a SQL-standard body (Postgres records what it depends on) that only calls
-- now(). Answering 200 proves the API gateway, PostgREST and the database are
-- all up.
create function public.ping() returns timestamptz
language sql stable set search_path = ''
begin atomic
  select now();
end;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
