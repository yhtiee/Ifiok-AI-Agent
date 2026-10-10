-- 0001 base: extensions and enums (specifications/03-data-model.md §1).
-- Extensions live in the `extensions` schema (Supabase convention). pg_cron, pg_net and pgmq
-- arrive with the job system in P0-11, where they are first used (12 §4 Q14).

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;

create type user_role as enum ('student','lecturer','admin');   -- subject curators are listed in `curators`
create type account_status as enum ('active','lecturer_pending','suspended','deleted');  -- under-18 sign-ups are never stored (08 §3)
create type course_status as enum ('active','pending','archived');
create type source_kind as enum ('textbook_private','notes','past_paper','lab_manual','handout','solution','scheme');
create type source_visibility as enum ('private','course','bank');
create type review_status as enum ('pending','approved','needs_review','rejected','withdrawn');
create type lesson_status as enum ('draft','review','published','superseded','hidden');
create type item_type as enum ('mcq','numeric','expression','short_text','order','match');
create type goal_kind as enum ('understand_topic','practical_ready','master_course','exam');
create type task_kind as enum ('lesson','review','practice','lab','preview','recap','remediation','mock','teach_back');
create type task_status as enum ('planned','done','skipped','rolled');
create type job_status as enum ('queued','running','done','failed');
create type submission_status as enum ('transcribing','needs_confirmation','marking','done','failed');
create type level_band as enum ('foundation','introductory','intermediate','advanced');
