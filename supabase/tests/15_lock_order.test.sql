-- KOL-12: block_user and report_user take the pair lock before anything else
-- they write or lock. pgTAP runs in one session, so it cannot race two
-- callers; the parallel check is web/scripts/block-report-concurrency.mjs.
-- This guards the order in the function source and that re-creating the
-- functions kept their privileges. Their behaviour is covered by
-- 03_chat_block_report (and 04, 05, 07, 12, which call block_user).

begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

-- block_user: pair lock before the blocks row is written.
select ok(strpos(prosrc, 'private.lock_pair(') > 0
          and strpos(prosrc, 'private.lock_pair(') < strpos(prosrc, 'insert into public.blocks'),
          'block_user takes the pair lock before writing the block')
from pg_proc where oid = 'public.block_user(uuid)'::regprocedure;

-- report_user: pair lock before the conversation row lock and the blocks row.
select ok(strpos(prosrc, 'private.lock_pair(') > 0
          and strpos(prosrc, 'private.lock_pair(') < strpos(prosrc, 'from public.conversations where id = p_conversation_id for update')
          and strpos(prosrc, 'private.lock_pair(') < strpos(prosrc, 'insert into public.blocks'),
          'report_user takes the pair lock before locking the conversation')
from pg_proc where oid = 'public.report_user(uuid, uuid, public.report_reason, text, boolean)'::regprocedure;

select is((select count(*)::int from pg_proc
           where oid in ('public.block_user(uuid)'::regprocedure,
                         'public.report_user(uuid, uuid, public.report_reason, text, boolean)'::regprocedure)
             and prosecdef and proconfig @> array['search_path=""']),
          2, 'both stay security definer with an empty search_path');

select ok(has_function_privilege('authenticated', 'public.block_user(uuid)', 'execute'),
          'signed-in users can still block');
select ok(has_function_privilege('authenticated',
          'public.report_user(uuid, uuid, public.report_reason, text, boolean)', 'execute'),
          'signed-in users can still report');
select ok(not has_function_privilege('anon', 'public.block_user(uuid)', 'execute'),
          'anon cannot block');
select ok(not has_function_privilege('anon',
          'public.report_user(uuid, uuid, public.report_reason, text, boolean)', 'execute'),
          'anon cannot report');
select ok(not exists (
            select 1 from pg_proc p, aclexplode(p.proacl) a
            where p.oid in ('public.block_user(uuid)'::regprocedure,
                            'public.report_user(uuid, uuid, public.report_reason, text, boolean)'::regprocedure)
              and a.grantee = 0 and a.privilege_type = 'EXECUTE'),
          'and neither is granted to PUBLIC');

select * from finish();
rollback;
