# 03 · Data model (Postgres / Supabase)

Rules:
- **Every table has RLS enabled.** No exceptions. pgTAP tests prove each policy (`supabase/tests`).
- Money and Units change **only** through the SQL functions in §6, which run as `security definer` and are granted to `service_role` only (or wrapped by narrow, user-callable functions that check `auth.uid()`).
- IDs: `uuid` (`gen_random_uuid()`), except high-volume logs (`bigint identity`). Client-created rows (attempts, lab runs, task completions) use **client-generated UUIDs** for idempotent offline sync.
- Timestamps: `timestamptz`, UTC. Display in Africa/Lagos.
- Naira amounts are **integers in kobo**. Units are **integers**.

The SQL below is the target schema, grouped into sections named `0001`–`0009`. **Migrations are append-only and follow the stages (`10`):** `0001`–`0005` and the job runtime are built (the applied migrations in `supabase/migrations` are the truth where they differ from the SQL below); Stage 1 adds materials, items, exam and lab tables or columns as its tickets need; the economy (`0006`, `0007`) and the Earn tables in §10 arrive in Stage 3; groups (`0008`) are deferred (Q40); lecturer-only parts (lecturer roles, `handout` uploads, licence fees, class insight) stay in the schema but are unused while lecturers are not served (Q39). Each migration carries the RLS policies for its own tables (collected in §8 for reading). Use the CLI's timestamped filenames (`supabase migration new <name>`); the section numbers here are names, not required filenames. It was loaded into PostgreSQL 16 with pgvector and tested with pgTAP (see `checks/README.md`).

## 1. Extensions and enums (`0001_base.sql`)

```sql
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists vector;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists pgmq;

create type user_role as enum ('student','lecturer','admin');   -- subject curators are listed in `curators` (§8)
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
```

## 2. People, courses, consent (`0002_people_courses.sql`)

```sql
create table universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  staff_email_domain text,
  country text not null default 'NG',
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  role user_role not null default 'student',
  status account_status not null default 'active',
  university_id uuid references universities(id),
  department text,
  level smallint check (level between 100 and 900),
  birth_year smallint check (birth_year between 1900 and 2100),
  birth_month smallint check (birth_month between 1 and 12),
  is_adult boolean not null default false,
  daily_minutes smallint not null default 30 check (daily_minutes in (15,30,45,60)),
  data_saver boolean not null default false,
  locale text not null default 'en-NG',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('terms','privacy','ai_disclosure','marketing','recording')),
  version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, kind, version)
);

-- Controlled subject list (seeded; admins add more). Courses, concepts and curators reference it,
-- so 'maths' and 'mathematics' can't become two subjects.
create table subjects (
  code text primary key,                                  -- e.g. 'mathematics', 'law', 'nursing'
  title text not null,
  sensitive boolean not null default false                -- health and law: lessons need a curator before publishing (F2-FR5)
);

-- Courses are created by students on demand (via /api/courses, which normalises the code,
-- suggests near-duplicates and moderates the title). Nothing is pre-loaded or curated by Ifiok.
create table courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  code text not null,                                     -- as typed, e.g. 'MTH 101'
  code_norm text generated always as (upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))) stored,
  title text not null,
  subject text references subjects(code),                 -- AI-suggested, editable
  outline_locked boolean not null default false,          -- a verified lecturer or rep can lock the outline
  level smallint,
  semester smallint check (semester in (1,2)),
  status course_status not null default 'active',
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (university_id, code_norm)
);

create table enrollments (
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  role text not null default 'student' check (role in ('student','lecturer','rep')),
  verified boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

create table micro_skills (
  code text primary key,
  subject text not null,
  title text not null,
  description text
);

-- level_band comes from the course level via app_config.level_bands (default: pre-degree → foundation,
-- 100 → introductory, 200–300 → intermediate, 400+ → advanced); free-standing topics use the
-- student's profile level, and the student can switch it.
-- Concepts are global and cross-university: "Limits of a function (introductory)" is one concept
-- whether a student meets it in MTH 101 at Uniuyo or MTH 111 at Unilag. Lessons, items and mastery
-- attach to concepts, so a lesson generated for one student is reused by every later student.
create type level_band as enum ('foundation','introductory','intermediate','advanced');
create table concepts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,                                     -- e.g. 'calculus.limits'; '-2', '-3'… appended on conflict
  title text not null,
  subject text not null references subjects(code),
  level_band level_band not null,
  description text,
  micro_skills text[] not null default '{}',
  prerequisite_hints text[] not null default '{}',        -- plain text from topic_resolve; linked in concept_prereqs only when those concepts already exist
  listed boolean not null default false,                  -- shown in search once its lesson is published and opened by >= 2 users
  embedding vector(384),                                  -- of title + description, for topic resolution
  current_lesson_id uuid,                                 -- FK added after lessons exists
  created_by uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','merged','blocked')),
  merged_into uuid references concepts(id),
  created_at timestamptz not null default now(),
  unique (slug, level_band)
);

-- A course's outline: its topics in order, each mapped to a concept. Built from what students
-- give us (an uploaded outline, typed topics, or an AI draft they confirm) and edited wiki-style.
create table topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  concept_id uuid not null references concepts(id),
  week smallint,
  position int not null,
  title text not null,                                    -- the course's own wording
  description text,
  archived_at timestamptz,                                -- topics are archived, never deleted once used
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table outline_revisions (                          -- history for wiki-style outline edits
  id bigint generated always as identity primary key,
  course_id uuid not null references courses(id) on delete cascade,
  editor_id uuid references profiles(id) on delete set null,
  source text not null check (source in ('upload','typed','ai_draft','edit','revert')),
  outline jsonb not null,                                 -- full ordered topic list after the change
  created_at timestamptz not null default now()
);

-- Topics a student is learning outside any course ("I want to understand Fourier series").
create table concept_follows (
  user_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,   -- set when followed from a course
  created_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

-- Term calendar per course: maps scheme weeks to dates; reps/admins can shift it when the semester slips.
create table course_terms (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  session text not null,                                 -- e.g. '2026/2027'
  semester smallint not null check (semester in (1,2)),
  starts_on date not null,                               -- Monday of scheme week 1
  current_week_override smallint,                        -- set when strikes/holidays shift the schedule
  exam_date date,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (course_id, session, semester)
);

create table concept_prereqs (
  concept_id uuid not null references concepts(id) on delete cascade,
  prereq_concept_id uuid not null references concepts(id) on delete cascade,
  primary key (concept_id, prereq_concept_id),
  check (concept_id <> prereq_concept_id)
);
```

## 3. Sources, chunks, lessons, items (`0003_content.sql`)

```sql
create table sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,   -- optional: uploads can be course-free
  kind source_kind not null,
  visibility source_visibility not null default 'private',
  title text not null,
  storage_path text,
  sha256 text,
  page_count int,
  review review_status not null default 'pending',
  review_reason text,
  license_attested_at timestamptz,
  is_lecturer_source boolean not null default false,
  created_at timestamptz not null default now(),
  check (kind <> 'textbook_private' or visibility = 'private'),
  check (kind <> 'textbook_private' or storage_path is null)
);
create index on sources (course_id, visibility, review);
create unique index sources_dedupe_bank on sources (sha256) where sha256 is not null and visibility = 'bank';     -- crowd bank is global
create unique index sources_dedupe_course on sources (course_id, sha256) where sha256 is not null and visibility = 'course';

create table chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null references sources(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,   -- tagged by the curate/embed job
  visibility source_visibility not null,
  page int,
  content text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  embedding vector(384),
  created_at timestamptz not null default now()
);
create index on chunks using gin (tsv);
-- No HNSW index in P0–P2: retrieval is an exact scan filtered by course (fast below ~200k chunks)
-- and avoids HNSW's post-filtering problem with RLS/course filters. When chunks > 200k, add
-- `using hnsw (embedding vector_cosine_ops)` and set hnsw.iterative_scan = relaxed_order (pgvector >= 0.8).
create index on chunks (course_id, visibility);
create index on chunks (concept_id, visibility);
create index on chunks (owner_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references concepts(id),
  course_id uuid references courses(id) on delete set null,   -- only for private lessons made from a course's material
  owner_id uuid references profiles(id) on delete cascade,    -- null = shared lesson, reused by everyone
  requested_by uuid references profiles(id) on delete set null,  -- the student whose request generated it
  kind text not null default 'topic' check (kind in ('topic','preview','micro','tutor_inline')),
  version int not null default 1,
  status lesson_status not null default 'draft',
  dsl_version smallint not null,
  spec jsonb not null,
  source_refs bigint[] not null default '{}',
  hidden_blocks text[] not null default '{}',             -- set by trigger when a block gets 3 flags
  trust text not null default 'new' check (trust in ('new','trusted')),   -- 'trusted' after use signals or a curator (F2)
  completions int not null default 0,
  sources_used int not null default 0,                    -- approved shared chunks it cites (refresh trigger, F2)
  model text,
  verified_by uuid references profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index lessons_shared_version on lessons (concept_id, kind, version) where owner_id is null;
alter table concepts add constraint concepts_current_lesson_fk foreign key (current_lesson_id) references lessons(id) on delete set null;
create index on lessons (owner_id) where owner_id is not null;

create table lesson_flags (
  id bigint generated always as identity primary key,
  lesson_id uuid not null references lessons(id) on delete cascade,
  block_id text not null,
  user_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (reason in ('wrong','unclear','offensive','other')),
  note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (lesson_id, block_id, user_id)
);

create table lesson_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  step int not null default 0,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table items (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references concepts(id),
  course_id uuid references courses(id) on delete set null,   -- set for past-paper items (course-specific style)
  lesson_id uuid references lessons(id) on delete set null,   -- set for checkpoints
  block_id text,                                              -- checkpoint block id within that lesson
  owner_id uuid references profiles(id) on delete cascade,   -- null = shared
  type item_type not null,
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  stem jsonb not null,
  answer jsonb not null,
  verification jsonb not null,
  explanation text,
  micro_skills text[] not null default '{}',
  origin text not null check (origin in ('checkpoint','generated','past_paper','bank','authored')),
  source_id uuid references sources(id) on delete set null,
  contributor_id uuid references profiles(id) on delete set null,
  status lesson_status not null default 'review',            -- auto-published only after both checks pass (05 §6)
  created_at timestamptz not null default now()
);
create index on items (concept_id, status, difficulty);
create unique index items_checkpoint on items (lesson_id, block_id) where lesson_id is not null;

create table exam_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,   -- the uploader picks the course at extraction
  source_id uuid not null references sources(id) on delete cascade,
  year smallint,
  number text,
  text_latex text not null,
  marks numeric(5,2),
  qtype text check (qtype in ('calc','theory','definition','proof','diagram','mcq')),
  concept_id uuid references concepts(id),                -- exam maps are keyed on (course_id, concept_id)
  concept_confidence numeric(3,2),
  item_id uuid references items(id),
  created_at timestamptz not null default now()
);
create index on exam_questions (course_id, concept_id);
```

## 4. Learning activity and planning (`0004_learning.sql`)

```sql
create table attempts (
  id uuid primary key,                                   -- client-generated
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  response jsonb not null,
  correct boolean not null,
  error_tag text references micro_skills(code),
  duration_ms int,
  created_at timestamptz not null default now()
);
create index on attempts (user_id, created_at desc);
create index on attempts (user_id, error_tag, created_at desc) where error_tag is not null;

create table review_cards (
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid not null references items(id) on delete cascade,
  due timestamptz not null,
  stability double precision not null,
  difficulty double precision not null,
  elapsed_days int not null default 0,
  scheduled_days int not null default 0,
  reps int not null default 0,
  lapses int not null default 0,
  state smallint not null default 0,
  last_review timestamptz,
  primary key (user_id, item_id)
);
create index on review_cards (user_id, due);

create table mastery (                                    -- per concept, so it carries across courses
  user_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  m numeric(4,3) not null default 0 check (m between 0 and 1),
  level text not null default 'not_started' check (level in ('not_started','familiar','proficient','mastered')),
  attempts_count int not null default 0,
  proficient_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  kind goal_kind not null,
  course_id uuid references courses(id) on delete cascade,
  concept_id uuid references concepts(id) on delete cascade,
  lab_slug text,
  target_date date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table plan_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_date date not null,
  kind task_kind not null,
  ref jsonb not null,
  est_minutes smallint not null,
  priority smallint not null,
  position smallint not null,
  reason text not null,
  status task_status not null default 'planned',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on plan_tasks (user_id, plan_date);

create table plan_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  kind text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table lab_runs (
  id uuid primary key,                                   -- client-generated
  user_id uuid not null references profiles(id) on delete cascade,
  lab_slug text not null,
  seed int not null,
  data jsonb not null,
  result jsonb,
  score numeric(5,2),
  created_at timestamptz not null default now()
);

create table submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  item_id uuid references items(id),
  image_path text not null,
  transcription jsonb,
  confirmed_transcription jsonb,
  verdict jsonb,
  status submission_status not null default 'transcribing',
  created_at timestamptz not null default now()
);

create table timetable_entries (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,   -- null = class timetable
  weekday smallint not null check (weekday between 0 and 6),
  starts time not null,
  ends time not null,
  venue text,
  week_range int4range,                                  -- scheme weeks this slot applies to; null = all
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- Tutor conversations (F1). Owner-only. Deleted with the account.
create table tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  title text not null default '',
  summary text,                                          -- running summary of turns older than the last 6
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tutor_threads (user_id, updated_at desc);

create table tutor_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references tutor_threads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content jsonb not null,                                -- user: {text}; assistant: tutor_chat output
  grounded boolean,
  created_at timestamptz not null default now()
);
create index on tutor_messages (thread_id, id);

-- Server-recorded learning evidence (written by /api/sync only). Rewards, usage points,
-- sessions and streaks read these, never client-writable tables.
create table screen_events (
  id uuid primary key,                                   -- client-generated (idempotent sync)
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  screen_id text not null,
  completed_at timestamptz not null,                     -- client time, clamped to server receive time
  received_at timestamptz not null default now()
);
create index on screen_events (user_id, received_at desc);

-- One row per user per Lagos day with any server-recorded activity. A "study session" is
-- >= 1 attempt or screen event within a 30-minute window; sessions are derived from these events.
create table daily_activity (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,                                     -- (now() at time zone 'Africa/Lagos')::date
  sessions smallint not null default 0,
  events int not null default 0,
  last_event_at timestamptz,                             -- a new session starts when received_at - last_event_at > 30 min
  primary key (user_id, day)
);
```

## 5. Platform: jobs, AI usage, config, moderation (`0005_platform.sql`)

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  queue text not null,
  owner_id uuid references profiles(id) on delete set null,
  status job_status not null default 'queued',
  dedupe_key text,
  payload jsonb not null,
  result jsonb,
  error text,
  attempts smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index jobs_active_dedupe on jobs (dedupe_key) where status in ('queued','running');

create table ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid references profiles(id) on delete set null,
  feature text not null,                    -- the skill name
  prompt_version smallint,
  provider text not null,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  thinking_tokens int not null default 0,                -- billed as output
  tool_rounds smallint not null default 0,
  cost_micros bigint not null,              -- USD millionths
  ok boolean not null default true,
  created_at timestamptz not null default now()
);
create index on ai_calls (created_at);
create index on ai_calls (user_id, created_at);

create table daily_usage (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  feature text not null,
  count int not null default 0,
  primary key (user_id, day, feature)
);

create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);

-- Waitlist for adults we can't serve yet (e.g. university not supported). Email only, explicit consent text version.
create table waitlist (
  email text primary key,
  reason text not null check (reason in ('university_not_supported')),   -- never used for under-18s (08 §3)
  consent_version text not null,
  created_at timestamptz not null default now()
);

create table admin_audit (
  id bigint generated always as identity primary key,
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  target text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_kind text not null check (target_kind in ('lesson','source','post','user','item')),
  target_id text not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now()
);

-- Atomic quota consumption (race-safe). Called by the gateway BEFORE a model call;
-- refund_quota is called if the call fails. Day boundary is Lagos time.
create or replace function consume_quota(p_user uuid, p_feature text, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Africa/Lagos')::date; v_count int;
begin
  if p_limit <= 0 then return false; end if;
  insert into daily_usage (user_id, day, feature, count) values (p_user, v_day, p_feature, 1)
  on conflict (user_id, day, feature) do update set count = daily_usage.count + 1
    where daily_usage.count < p_limit
  returning count into v_count;
  return v_count is not null;
end $$;

create or replace function refund_quota(p_user uuid, p_feature text)
returns void language sql security definer set search_path = public as $$
  update daily_usage set count = greatest(count - 1, 0)
  where user_id = p_user and feature = p_feature and day = (now() at time zone 'Africa/Lagos')::date;
$$;

-- Job enqueue. Server-only: user-facing enqueues go through /api/jobs/enqueue, which allow-lists
-- queues ('mark_transcribe','ocr','lesson_gen' for private lessons) and rate-limits. mark_verify is
-- enqueued by /api/snap/:id/confirm or by the mark_transcribe handler, never by the generic endpoint.
create or replace function enqueue_job(p_queue text, p_payload jsonb, p_dedupe text default null, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into jobs (queue, owner_id, dedupe_key, payload) values (p_queue, p_owner, p_dedupe, p_payload)
  on conflict (dedupe_key) where status in ('queued','running') do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from jobs where dedupe_key = p_dedupe and status in ('queued','running');
    return v_id;
  end if;
  -- In Supabase: perform pgmq.send(p_queue, jsonb_build_object('job_id', v_id));
  -- and a trigger on jobs calls the worker via pg_net (02 §4).
  return v_id;
end $$;

revoke execute on function consume_quota(uuid, text, int) from public, anon, authenticated;
revoke execute on function refund_quota(uuid, text) from public, anon, authenticated;
revoke execute on function enqueue_job(text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function consume_quota(uuid, text, int), refund_quota(uuid, text),
  enqueue_job(text, jsonb, text, uuid) to service_role;
```

**Merging duplicates** (admin only, MFA, audited; called from the admin merge tool). Course merges follow the same pattern (`merge_courses`: move enrolments, topics, terms and sources; the loser is archived).

```sql
create or replace function merge_concepts(p_loser uuid, p_survivor uuid, p_admin uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_max int;
begin
  if p_loser = p_survivor then raise exception 'cannot merge a concept into itself'; end if;
  perform 1 from concepts where id in (p_loser, p_survivor) order by id for update;

  -- Mastery: keep the best progress for each student.
  insert into mastery (user_id, concept_id, m, level, attempts_count, proficient_at, updated_at)
    select user_id, p_survivor, m, level, attempts_count, proficient_at, now() from mastery where concept_id = p_loser
  on conflict (user_id, concept_id) do update set
    m = greatest(mastery.m, excluded.m),
    level = case when array_position(array['not_started','familiar','proficient','mastered'], excluded.level)
                    > array_position(array['not_started','familiar','proficient','mastered'], mastery.level)
                 then excluded.level else mastery.level end,
    attempts_count = mastery.attempts_count + excluded.attempts_count,
    proficient_at = least(mastery.proficient_at, excluded.proficient_at),
    updated_at = now();
  delete from mastery where concept_id = p_loser;

  insert into concept_follows (user_id, concept_id, course_id, created_at)
    select user_id, p_survivor, course_id, created_at from concept_follows where concept_id = p_loser
  on conflict do nothing;
  delete from concept_follows where concept_id = p_loser;

  -- Shared lessons: the loser's versions move above the survivor's and stop being current.
  select coalesce(max(version), 0) into v_max from lessons where concept_id = p_survivor and owner_id is null;
  update lessons set concept_id = p_survivor, version = version + v_max,
         status = case when status = 'published' then 'superseded'::lesson_status else status end
   where concept_id = p_loser and owner_id is null;
  update lessons set concept_id = p_survivor where concept_id = p_loser and owner_id is not null;

  update items set concept_id = p_survivor where concept_id = p_loser;
  update chunks set concept_id = p_survivor where concept_id = p_loser;
  update topics set concept_id = p_survivor where concept_id = p_loser;
  update exam_questions set concept_id = p_survivor where concept_id = p_loser;
  update goals set concept_id = p_survivor where concept_id = p_loser;

  insert into concept_prereqs (concept_id, prereq_concept_id)
    select a, b from (
      select case when concept_id = p_loser then p_survivor else concept_id end as a,
             case when prereq_concept_id = p_loser then p_survivor else prereq_concept_id end as b
      from concept_prereqs where p_loser in (concept_id, prereq_concept_id)) m
    where a <> b
  on conflict do nothing;
  delete from concept_prereqs where p_loser in (concept_id, prereq_concept_id);

  update concepts set status = 'merged', merged_into = p_survivor, current_lesson_id = null, listed = false
   where id = p_loser;
  insert into admin_audit (admin_id, action, target, detail)
    values (p_admin, 'merge_concepts', p_loser::text, jsonb_build_object('survivor', p_survivor));
end $$;
revoke execute on function merge_concepts(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function merge_concepts(uuid, uuid, uuid) to service_role;
```

## 6. Economy (`0006_economy.sql`) — see `06` for the rules

Convention: **signed double-entry.** Debit = positive, credit = negative. Every transaction's entries sum to **zero per currency**. Each account has a `normal_side`; the **display balance** = `balance` for debit-normal accounts and `-balance` for credit-normal accounts. User accounts are credit-normal (we owe the user) and their display balance can never go below zero.

```sql
create table ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete restrict,       -- null = system account
  kind text not null check (kind in (
    'user_units_purchased','user_units_earned',
    'user_earnings_pending','user_earnings_available',
    'unit_issuance','units_deferred_revenue','units_sales_revenue','earnings_conversion','licence_fees',
    'paystack_clearing','payment_fees','transfer_fees',
    'pool_expense','contributor_pool','payout_clearing','sponsor_pool','levies')),
  currency text not null check (currency in ('UNIT','NGN')),
  normal_side text not null check (normal_side in ('debit','credit')),
  balance bigint not null default 0,
  created_at timestamptz not null default now(),
  unique nulls not distinct (owner_id, kind)
);

create table ledger_txns (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  idempotency_key text not null unique,
  meta jsonb not null default '{}',
  created_by uuid,
  created_at timestamptz not null default now()
);

create table ledger_entries (
  id bigint generated always as identity primary key,
  txn_id uuid not null references ledger_txns(id),
  account_id uuid not null references ledger_accounts(id),
  amount bigint not null check (amount <> 0),
  created_at timestamptz not null default now()
);
create index on ledger_entries (account_id, created_at desc);

create table unit_lots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete restrict,
  source text not null check (source in ('purchased','earned','converted')),
  amount int not null check (amount > 0),
  remaining int not null check (remaining >= 0),
  kobo_per_unit int not null default 0,            -- ₦ value per Unit for purchased/converted lots; 0 for earned
  expires_at timestamptz,                          -- null for purchased/converted
  txn_id uuid not null references ledger_txns(id),
  created_at timestamptz not null default now()
);
create index on unit_lots (user_id, expires_at) where remaining > 0;

-- Which lots each spend/expiry/refund touched. Lets refunds restore the same lots and lets
-- compute_period recognise revenue from Units actually consumed (value = units × kobo_per_unit).
create table lot_moves (
  id bigint generated always as identity primary key,
  txn_id uuid not null references ledger_txns(id),
  lot_id uuid not null references unit_lots(id),
  units int not null check (units <> 0),           -- negative = consumed, positive = restored
  created_at timestamptz not null default now()
);
create index on lot_moves (lot_id);

create table topups (
  reference text primary key,
  user_id uuid not null references profiles(id),
  amount_kobo bigint not null check (amount_kobo > 0),
  units int not null check (units > 0),
  status text not null default 'initialized' check (status in ('initialized','success','failed')),
  paystack_fee_kobo bigint,
  payload jsonb,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table usage_events (
  id bigint generated always as identity primary key,
  resource_kind text not null check (resource_kind in ('source','item','post','lesson')),
  resource_id uuid not null,
  contributor_id uuid not null references profiles(id) on delete cascade,
  consumer_id uuid references profiles(id) on delete set null,
  period date not null,                            -- first day of month
  weight numeric(4,2) not null default 1,
  created_at timestamptz not null default now(),
  unique (resource_kind, resource_id, consumer_id, period),
  check (consumer_id is null or contributor_id <> consumer_id)
);
create index on usage_events (period, contributor_id);

create table payout_periods (
  period date primary key,
  net_revenue_kobo bigint,
  pool_kobo bigint,
  status text not null default 'open' check (status in ('open','computed','approved','paid')),
  computed_at timestamptz,
  approved_by uuid references profiles(id)
);

create table payout_lines (
  period date not null references payout_periods(period),
  contributor_id uuid not null references profiles(id),
  points numeric(12,2) not null,
  amount_kobo bigint not null,
  release_at timestamptz not null,
  released boolean not null default false,
  primary key (period, contributor_id)
);

create table payout_recipients (
  user_id uuid primary key references profiles(id),
  bank_code text not null,
  account_last4 text not null,
  legal_name text not null,                              -- entered by the user; compared with the resolved name
  account_name text not null,                            -- as resolved by Paystack
  recipient_code text not null,
  name_match_score numeric(3,2),
  verified_at timestamptz not null default now()
);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  amount_kobo bigint not null check (amount_kobo >= 200000),
  levy_kobo bigint not null default 0,                   -- stamp duty withheld (posted to 'levies')
  status text not null default 'requested' check (status in ('requested','processing','paid','failed','reversed')),
  transfer_code text,
  idempotency_key text not null unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Core posting function. All economy changes go through here.
create or replace function post_txn(p_kind text, p_idem text, p_entries jsonb, p_meta jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn uuid;
  v_e jsonb;
  v_acc ledger_accounts%rowtype;
  v_amount bigint;
  v_sum_unit bigint := 0;
  v_sum_ngn bigint := 0;
  v_bad text;
begin
  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) < 2 then
    raise exception 'a transaction needs at least two entries';
  end if;

  -- Idempotency that is safe under concurrency: the unique key decides the winner.
  insert into ledger_txns (kind, idempotency_key, meta) values (p_kind, p_idem, p_meta)
  on conflict (idempotency_key) do nothing
  returning id into v_txn;
  if v_txn is null then
    select id into v_txn from ledger_txns where idempotency_key = p_idem;
    return v_txn;                                  -- replay: no change
  end if;

  -- Lock every touched account in a fixed order (by id) to avoid deadlocks.
  perform 1 from ledger_accounts
    where id in (select (e->>'account_id')::uuid from jsonb_array_elements(p_entries) e)
    order by id for update;

  for v_e in select * from jsonb_array_elements(p_entries) loop
    v_amount := (v_e->>'amount')::bigint;
    select * into v_acc from ledger_accounts where id = (v_e->>'account_id')::uuid;
    if not found then
      raise exception 'unknown account %', v_e->>'account_id';
    end if;

    insert into ledger_entries (txn_id, account_id, amount) values (v_txn, v_acc.id, v_amount);
    update ledger_accounts set balance = balance + v_amount where id = v_acc.id;

    if v_acc.currency = 'UNIT' then
      v_sum_unit := v_sum_unit + v_amount;
    else
      v_sum_ngn := v_sum_ngn + v_amount;
    end if;
  end loop;

  if v_sum_unit <> 0 or v_sum_ngn <> 0 then
    raise exception 'unbalanced transaction (unit %, ngn %)', v_sum_unit, v_sum_ngn;
  end if;

  -- After all entries: no user (credit-normal) account may show a negative display balance.
  select a.kind into v_bad from ledger_accounts a
    where a.id in (select (e->>'account_id')::uuid from jsonb_array_elements(p_entries) e)
      and a.owner_id is not null and a.normal_side = 'credit' and a.balance > 0
    limit 1;
  if v_bad is not null then
    raise exception 'insufficient balance on %', v_bad;
  end if;

  return v_txn;
end;
$$;

revoke all on function post_txn(text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function post_txn(text, text, jsonb, jsonb) to service_role;
```

**Grants:** Supabase gives `anon` and `authenticated` EXECUTE on new functions by default. Every economy function revokes that and grants only to `service_role`, except the user-callable ones (`request_withdrawal`, `convert_earnings`), which are granted to `authenticated` and check `auth.uid()` inside.

Higher-level economy functions (all `security definer`, implemented in `0007_economy_functions.sql`, contract defined in `06` §8): `ensure_user_accounts(uid)`, `confirm_topup(reference, amount_kobo, fee_kobo)`, `spend_units(uid, feature, amount, idem)`, `earn_units(uid, reason, amount, idem)`, `expire_units()`, `record_usage(kind, resource_id, consumer)`, `compute_period(period)`, `approve_period(period)`, `release_earnings()`, `request_withdrawal(amount_kobo, idem)` (user-callable; checks `auth.uid()`), `settle_withdrawal(transfer_code, success, fee_kobo)`, `convert_earnings(amount_kobo, idem)` (user-callable).

## 7. Groups (deferred, `12` §4 Q40; `0008_groups.sql`)

```sql
create table groups (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  name text not null,
  is_course_group boolean not null default false,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator')),
  primary key (group_id, user_id)
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  parent_id uuid references posts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  accepted boolean not null default false,
  ai_check jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index on posts (group_id, created_at desc);
```

## 8. RLS (section `0009`: helpers first, then each table's policies go in the migration that creates the table)

Helper functions (stable, `security definer`, `set search_path = public`):

```sql
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  -- Admins must have signed in with MFA (TOTP): the JWT's aal claim is 'aal2'.
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;

create or replace function is_adult_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and is_adult and status = 'active');
$$;

create or replace function is_member(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments where user_id = auth.uid() and course_id = p_course);
$$;

-- Curators: volunteer or paid subject reviewers (P1+). They can see and fix lessons for concepts
-- in their subjects. Optional: lessons don't wait for them (F2).
create table curators (
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null references subjects(code),
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, subject)
);
alter table curators enable row level security;
alter table subjects enable row level security;
create policy subjects_read on subjects for select using (true);
create policy curators_read_own on curators for select using (user_id = auth.uid() or is_admin());

create or replace function is_curator(p_concept uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from curators cu join concepts c on c.subject = cu.subject
                 where cu.user_id = auth.uid() and c.id = p_concept);
$$;

create or replace function is_course_lecturer(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from enrollments e join profiles p on p.id = e.user_id
                 where e.user_id = auth.uid() and e.course_id = p_course
                   and e.role = 'lecturer' and e.verified and p.role = 'lecturer');
$$;
```

Policies (enable RLS on every table first):

```sql
-- Display names for wiki history and curator credits (no other profile fields).
create view public_profiles with (security_invoker = false) as select id, display_name from profiles where status = 'active';
grant select on public_profiles to authenticated;

alter table profiles enable row level security;
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid());
-- role, status, is_adult, birth_* are changed only by server code. Enforce with column grants:
revoke update on profiles from authenticated, anon;
grant update (display_name, university_id, department, level, daily_minutes, data_saver, locale)
  on profiles to authenticated;

alter table courses enable row level security;
create policy courses_read on courses for select using (auth.uid() is not null);
-- Courses are created through /api/courses (dedupe, moderation, rate limit); no direct client insert.
revoke insert, update, delete on courses from authenticated, anon;

alter table concepts enable row level security;
create policy concepts_read on concepts for select using (auth.uid() is not null and status <> 'blocked');
-- concepts are created by the topic_resolve step on the server only.
alter table concept_prereqs enable row level security;
create policy cp_read on concept_prereqs for select using (auth.uid() is not null);
alter table concept_follows enable row level security;
create policy follows_own on concept_follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table outline_revisions enable row level security;
create policy outline_rev_read on outline_revisions for select using (is_member(course_id) or is_admin());

alter table topics enable row level security;
create policy topics_read on topics for select using (auth.uid() is not null);
-- Outline edits go through /api/courses/:id/outline (server): any enrolled adult may edit unless the
-- outline is locked (then lecturer/rep/admin only); every edit writes outline_revisions and maps
-- new topics to concepts via topic_resolve. No direct client writes.
revoke insert, update, delete on topics from authenticated, anon;

alter table enrollments enable row level security;
create policy enroll_self on enrollments for select using (user_id = auth.uid() or is_admin());
create policy enroll_insert_self on enrollments for insert
  with check (user_id = auth.uid() and role = 'student' and not verified and is_adult_active());
create policy enroll_delete_self on enrollments for delete using (user_id = auth.uid());

alter table sources enable row level security;
-- Clients read only their own sources. Crowd material reaches other students through the server:
-- citation snippets via /api/citations/:chunk_id (only for chunks cited in something the user can
-- see), and file downloads via 60 s signed URLs for notes/lab_manual/solution to course members.
-- Past papers are never shown; they feed exam maps and item style on the server only.
create policy sources_read on sources for select using (owner_id = auth.uid() or is_admin());
-- Clients may create private sources and rename them; review, visibility, lecturer flag and
-- licence fields are set only by server code (submit_to_bank → curate job; lecturer uploads).
revoke insert, update on sources from authenticated, anon;
grant insert (id, owner_id, course_id, kind, title, sha256, page_count) on sources to authenticated;
grant update (title) on sources to authenticated;
create policy sources_insert on sources for insert with check (
  owner_id = auth.uid() and is_adult_active()
  and kind in ('textbook_private','notes','past_paper','lab_manual','solution')   -- handout/scheme: lecturers via server
  and visibility = 'private' and review = 'pending' and not is_lecturer_source and storage_path is null);
-- storage_path and license_attested_at are set by submit_to_bank (server) after it checks the
-- storage object exists and the attestation was ticked.
create policy sources_update_own on sources for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table chunks enable row level security;
-- Clients read only their own chunks (no bulk scraping of the crowd bank). Server code uses
-- match_chunks (tutor) and shared_lesson_sources (shared lessons).
create policy chunks_read on chunks for select using (owner_id = auth.uid());
-- chunks are written by Edge Functions (service role) only.

alter table lessons enable row level security;
-- Private lessons (owner_id not null) are visible to their owner only: not to lecturers, not to admins.
-- Shared lessons are global: any active adult can read published ones. Admins and curators
-- also see lessons in review. Private lessons are visible to their owner only.
create policy lessons_read on lessons for select using (
  (owner_id is null and status in ('published','superseded') and is_adult_active())
  or owner_id = auth.uid()
  or (owner_id is null and (is_admin() or is_curator(concept_id))));
-- No client UPDATE on lessons: edits go through /api/lessons/:id (verification gate +
-- admin_audit with the actor), which uses the service role after checking is_admin / is_curator.
revoke insert, update, delete on lessons from authenticated, anon;

-- Three distinct flags on a block hide it pending review.
create or replace function hide_flagged_block() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(distinct user_id) from lesson_flags
      where lesson_id = new.lesson_id and block_id = new.block_id and resolved_at is null) >= 3 then
    update lessons set hidden_blocks = array_append(hidden_blocks, new.block_id)
    where id = new.lesson_id and not (new.block_id = any(hidden_blocks));
  end if;
  return new;
end $$;
create trigger lesson_flags_hide after insert on lesson_flags
  for each row execute function hide_flagged_block();

alter table items enable row level security;
create policy items_read on items for select using (
  (owner_id is null and status = 'published' and is_adult_active()) or owner_id = auth.uid() or is_admin());

-- Per-user tables: owner-only read/write.
-- Attempts are inserted by the sync route (service role), which re-grades objective items
-- server-side before saving and updates mastery. Clients read their own.
alter table attempts enable row level security;
create policy attempts_read_own on attempts for select using (user_id = auth.uid());
alter table review_cards enable row level security;
create policy cards_read_own on review_cards for select using (user_id = auth.uid());   -- written by /api/sync
alter table mastery enable row level security;
create policy mastery_read_own on mastery for select using (user_id = auth.uid());   -- written by /api/sync
alter table goals enable row level security;
create policy goals_own on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table plan_tasks enable row level security;
create policy tasks_read_own on plan_tasks for select using (user_id = auth.uid());
-- Clients may only skip a task; completion ('done') is set by /api/sync from server evidence.
revoke update on plan_tasks from authenticated, anon;
grant update (status) on plan_tasks to authenticated;
create policy tasks_skip_own on plan_tasks for update using (user_id = auth.uid() and status = 'planned')
  with check (user_id = auth.uid() and status = 'skipped');
alter table lab_runs enable row level security;
create policy labruns_own on lab_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table lesson_progress enable row level security;   -- UI resume state only; never used for rewards
create policy progress_own on lesson_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table screen_events enable row level security;
create policy se_read_own on screen_events for select using (user_id = auth.uid());
alter table daily_activity enable row level security;
create policy da_read_own on daily_activity for select using (user_id = auth.uid());
alter table course_terms enable row level security;
create policy terms_read on course_terms for select using (is_member(course_id) or is_admin());
-- course_terms writes: reps/lecturers/admins through a server route.
alter table submissions enable row level security;
create policy subs_read_own on submissions for select using (user_id = auth.uid());
alter table lesson_flags enable row level security;
create policy flags_insert on lesson_flags for insert with check (user_id = auth.uid());
create policy flags_read on lesson_flags for select using (user_id = auth.uid() or is_admin());
alter table consents enable row level security;
create policy consents_own on consents for select using (user_id = auth.uid());
alter table jobs enable row level security;
create policy jobs_read_own on jobs for select using (owner_id = auth.uid() or is_admin());
alter table tutor_threads enable row level security;
create policy threads_own on tutor_threads for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table tutor_messages enable row level security;
create policy tmsg_read_own on tutor_messages for select using (user_id = auth.uid());
-- tutor messages are written by /api/tutor (service role) only.
alter table push_subscriptions enable row level security;
create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
alter table timetable_entries enable row level security;
create policy tt_read on timetable_entries for select using (
  (owner_id is null and is_member(course_id)) or owner_id = auth.uid());
create policy tt_write_own on timetable_entries for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and created_by = auth.uid());

-- Economy: users may read their own accounts, lots, topups, withdrawals, payout lines.
alter table ledger_accounts enable row level security;
create policy acct_own on ledger_accounts for select using (owner_id = auth.uid() or is_admin());
alter table ledger_entries enable row level security;
create policy entries_own on ledger_entries for select using (
  exists (select 1 from ledger_accounts a where a.id = account_id and (a.owner_id = auth.uid() or is_admin())));
alter table ledger_txns enable row level security;
create policy txns_admin on ledger_txns for select using (is_admin());
alter table lot_moves enable row level security;   -- server-only
alter table unit_lots enable row level security;
create policy lots_own on unit_lots for select using (user_id = auth.uid());
alter table topups enable row level security;
create policy topups_own on topups for select using (user_id = auth.uid());
alter table withdrawals enable row level security;
create policy wd_own on withdrawals for select using (user_id = auth.uid());
alter table payout_lines enable row level security;
create policy pl_own on payout_lines for select using (contributor_id = auth.uid());

-- Admin-only / server-only tables: RLS on with no user policies (service role bypasses RLS).
alter table ai_calls enable row level security;
alter table daily_usage enable row level security;
create policy usage_read_own on daily_usage for select using (user_id = auth.uid());
alter table app_config enable row level security;
create policy config_read on app_config for select using (auth.uid() is not null);
alter table admin_audit enable row level security;
alter table waitlist enable row level security;   -- server-only
alter table reports enable row level security;
create policy reports_insert on reports for insert with check (reporter_id = auth.uid());
alter table usage_events enable row level security;
alter table payout_periods enable row level security;
alter table payout_recipients enable row level security;
create policy recip_own on payout_recipients for select using (user_id = auth.uid());
alter table exam_questions enable row level security;
create policy eq_read on exam_questions for select using (is_member(course_id) or is_admin());
alter table plan_events enable row level security;
create policy pe_own on plan_events for select using (user_id = auth.uid());
alter table micro_skills enable row level security;
create policy ms_read on micro_skills for select using (true);

alter table universities enable row level security;
create policy uni_read on universities for select using (true);
```

Groups (P3; add these in the groups migration):

```sql
create or replace function is_group_member(p_group uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = p_group and user_id = auth.uid());
$$;

alter table groups enable row level security;
create policy groups_read on groups for select using (
  is_group_member(id) or (is_course_group and is_member(course_id)) or is_admin());
alter table group_members enable row level security;
create policy gm_read on group_members for select using (is_group_member(group_id) or is_admin());
alter table posts enable row level security;
create policy posts_read on posts for select using (
  is_admin() or (is_group_member(group_id) and (not hidden or author_id = auth.uid())));
create policy posts_insert on posts for insert with check (
  author_id = auth.uid() and is_group_member(group_id) and is_adult_active()
  and not accepted and not hidden and ai_check is null);
-- Authors may edit only the body; accepting, hiding and AI checks happen in server code.
revoke update on posts from authenticated, anon;
grant update (body) on posts to authenticated;
create policy posts_update_own on posts for update using (author_id = auth.uid())
  with check (author_id = auth.uid());
-- Joining groups and moderation go through server routes (service role).
```

**Storage buckets**
- `uploads` (private): path `{user_id}/{source_id}/{file}`. Policy: owner read/write; admins read; Edge Functions use the service role. Bank files are served through **signed URLs** (60 s) after an RLS check, never public.
- `submissions` (private): path `{user_id}/{submission_id}.jpg`. Deleted 7 days after marking (keeps the free 1 GB storage within limits; see `09` §3).
- `public-assets` (public): lab models, seed images, OG images.

## 9. Retrieval RPC

```sql
create or replace function match_chunks(p_user uuid, p_course uuid, p_concept uuid, p_query text, p_embedding vector(384), p_limit int default 6)
returns table (id bigint, source_id uuid, page int, content text, score double precision)
language sql stable security definer set search_path = public as $$
  -- Visible chunks for this request: the caller's own private chunks, approved crowd ('bank')
  -- chunks from any university, and approved 'course' chunks of a course the caller is enrolled
  -- in. Scoped to the course and/or concept being studied. Explicit filter (no reliance on RLS)
  -- because this runs from server code with the service role.
  with visible as (
    select c.id, c.tsv, c.embedding
    from chunks c
    join sources s on s.id = c.source_id
    where ( (p_course is not null and c.course_id = p_course)
         or (p_concept is not null and c.concept_id = p_concept) )
      and ( c.owner_id = p_user
         or ( s.review = 'approved' and c.visibility = 'bank' and s.kind <> 'past_paper' )
         or ( s.review = 'approved' and c.visibility = 'course'
              and s.kind <> 'past_paper'
              and exists (select 1 from enrollments e where e.user_id = p_user and e.course_id = c.course_id) ) )
  ),
  q as (  -- OR the query words: natural-language questions rarely match every word
    select to_tsquery('english', replace(plainto_tsquery('english', p_query)::text, ' & ', ' | ')) as tsq
  ),
  fts as (
    select v.id, ts_rank(v.tsv, q.tsq) as r
    from visible v, q
    where v.tsv @@ q.tsq
    order by r desc limit 20
  ),
  vec as (
    select v.id, 1 - (v.embedding <=> p_embedding) as r
    from visible v
    where p_embedding is not null and v.embedding is not null
    order by v.embedding <=> p_embedding limit 20
  ),
  fused as (
    select id, sum(score) as score from (
      select id, 1.0 / (60 + row_number() over (order by r desc)) as score from fts
      union all
      select id, 1.0 / (60 + row_number() over (order by r desc)) as score from vec
    ) s group by id
  )
  select c.id, c.source_id, c.page, c.content, f.score
  from fused f join chunks c on c.id = f.id
  order by f.score desc
  limit p_limit;
$$;
revoke execute on function match_chunks(uuid, uuid, uuid, text, vector, int) from public, anon, authenticated;

-- The ONLY source of chunks for shared (global) lessons and their refreshes: approved crowd ('bank')
-- chunks for the concept, excluding past papers. Never private chunks, never course-only chunks.
create or replace function shared_lesson_sources(p_concept uuid, p_limit int default 40)
returns table (id bigint, source_id uuid, page int, content text)
language sql stable security definer set search_path = public as $$
  select c.id, c.source_id, c.page, c.content
  from chunks c join sources s on s.id = c.source_id
  where c.concept_id = p_concept and c.visibility = 'bank'
    and s.review = 'approved' and s.kind <> 'past_paper'
  order by c.id
  limit p_limit;
$$;
revoke execute on function shared_lesson_sources(uuid, int) from public, anon, authenticated;
grant execute on function shared_lesson_sources(uuid, int) to service_role;
grant execute on function match_chunks(uuid, uuid, uuid, text, vector, int) to service_role;
```

The function filters explicitly by `p_user` and is callable only by the service role, so a server bug that uses the admin client cannot leak another user's private chunks. `lib/ai/retrieve.ts` always passes the authenticated user's id (never an id from the request body). Queued jobs check that every chunk id in a payload belongs to the job owner or is shared. Reciprocal-rank fusion with k = 60. Exact vector scan (no HNSW) until ~200k chunks; the `(concept_id, visibility)` and `(course_id, visibility)` indexes keep the scan small. Requires at least one of `p_course` / `p_concept` (the API enforces it).

## 10. Planned tables for later stages (design notes; final SQL lands with each ticket)

Each table below gets RLS and pgTAP in the migration that creates it, and every money-moving write goes through an idempotent `security definer` function (guardrail 5).

**Stage 1 (MVP)**
- `sources` / `chunks`: already exist; MVP-01 writes private sources with `storage_path` null (text only, `kind` from the upload type) and page-aware chunks with embeddings.
- `lessons`: private lessons from a student's materials use `owner_id = student` (already supported by RLS).
- `exam_plans` (`user_id`, `course_id`, `exam_date`, `plan jsonb`, `created_at`): the deterministic study plan to the exam date; owner-only.
- `lab_configs` (`id`, `owner_id`, `course_id`, `source_id` null for topic-built labs, `config jsonb`, `config_hash`, `status 'ready'|'declined'`, `decline_reason`): verified virtual experiment configurations; owner-only in Stage 1 (shared by concept later). `lab_runs` already exists (`lab_slug = 'experiment'`).

- `explainers`, `earned_units_pending` (`user_id`, `reason` (approved_upload, consumer, …), `units`, `resource_id`, `period`, unique on (`user_id`, `reason`, `resource_id`, `period`)), `tutor_profiles` and usage points (`06` §4) move into Stage 1 with MVP-06 (Q42); their designs follow.

**Stage 3 (Earn)**
- `explainers` (`id`, `author_id`, `concept_id`, `format 'text'|'voice'|'video'`, `body_md` for text, `media_key`, `duration_s`, `size_bytes`, `transcript`, `status 'pending'|'in_review'|'published'|'held'|'rejected'|'withdrawn'`, `review jsonb`, `published_at`): authors read their own; anyone adult reads `published`; status changes only through server functions.
- `curator_reviews` (`id`, `curator_id`, `lesson_id`, `result 'accepted'|'rejected'`, `spot_checked_by`, `amount_kobo`, `period`): one payable line per accepted review, unique on (`curator_id`, `lesson_id`); curators read their own; writes server-only.
- `tutor_profiles` (`user_id`, `concepts uuid[]` limited to Mastered concepts, `price_kobo`, `availability jsonb`, `status`), `tutoring_bookings` (`id`, `learner_id`, `tutor_id`, `concept_id`, `starts_at`, `price_kobo`, `commission_kobo`, `state 'pending_payment'|'held'|'released'|'refunded'|'disputed'`, `partner_ref`, timestamps), `tutoring_events` (append-only state transitions with the partner's references): learner and tutor read their own bookings; state changes only through idempotent server functions keyed on the booking id; no escrow balances are stored (the partner holds the money).
- Usage points (`06` §4) gain a `resource_kind` value for explainers.
