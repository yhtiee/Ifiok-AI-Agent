-- Schema-wide guarantees (CLAUDE.md guardrails 4 and 5). Every new table and function is covered
-- automatically: no need to edit this file when adding one.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select is(
  (select array_agg(tablename::text order by tablename) from pg_tables where schemaname = 'public' and not rowsecurity),
  null,
  'every public table has RLS enabled');

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  null,
  'every security definer function pins its search_path');

-- Only the RLS helpers and is_review_admin (read-only booleans about the caller) may be called by clients.
select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname not in ('is_admin','is_review_admin','is_adult_active','is_member','is_curator','is_course_lecturer')
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))),
  null,
  'security definer functions other than RLS helpers are not callable by anon or authenticated');


select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  null,
  'anon can execute no security definer function');

select ok(
  (select bool_and(has_function_privilege('authenticated', p.oid, 'execute'))
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('is_admin','is_review_admin','is_adult_active','is_member','is_curator','is_course_lecturer')),
  'signed-in users can execute the RLS helpers their policies call');

select * from finish();
rollback;
