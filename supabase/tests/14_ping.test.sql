-- KOL-09: public.ping() is the uptime check's target. Anyone with the anon key
-- can call it, so it must read no tables.

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

select plan(9);

select ok(has_function_privilege('anon', 'public.ping()', 'execute'), 'anon can execute ping');
select ok(has_function_privilege('authenticated', 'public.ping()', 'execute'), 'signed-in users can too');
select ok(not exists (
            select 1 from pg_proc p, aclexplode(p.proacl) a
            where p.oid = 'public.ping()'::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
          'but not PUBLIC in general');

-- Reads nothing: no table, view or sequence appears among what it depends on.
select is((select count(*)::int from pg_depend d
           where d.classid = 'pg_proc'::regclass and d.objid = 'public.ping()'::regprocedure
             and d.refclassid = 'pg_class'::regclass),
          0, 'ping depends on no table');
select is((select prokind::text || ':' || provolatile::text || ':' || prosecdef::text from pg_proc
           where oid = 'public.ping()'::regprocedure),
          'f:s:false', 'a stable, invoker-rights function');
select is((select l.lanname::text from pg_proc p join pg_language l on l.oid = p.prolang
           where p.oid = 'public.ping()'::regprocedure),
          'sql', 'written in SQL');

-- As the anonymous role, with no access to any table beyond the public ones.
set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select lives_ok($$select public.ping()$$, 'anon can call it');
select is(public.ping(), now(), 'and gets the current time');
select is(pg_typeof(public.ping())::text, 'timestamp with time zone', 'as a timestamp');
reset role;

select * from finish();
rollback;
