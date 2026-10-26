-- MVP-05 virtual labs (F4 amended, 05 §9, 04 §4.8, 12 §4 Q55). A lab is a configuration of the
-- hand-built experiment engine, extracted by lab_extract from a lab manual or a requested topic and
-- saved only after the experiment verifier passes; anything else is stored as declined, never faked.
--
-- Topic-built labs carry nothing private, so they are shared (owner_id null) and cached by topic;
-- labs from a student's own manual are private to them. The full configuration (with the hidden
-- true constants) is readable by the server only: clients may select only the public columns.

create table labs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  origin text not null check (origin in ('manual', 'topic')),
  topic_key text,
  source_id uuid references sources(id) on delete cascade,
  title text not null,
  subject text,
  status text not null check (status in ('ready', 'declined')),
  decline_reason text,
  config jsonb,
  public_config jsonb,
  config_hash text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (origin = 'topic' or (owner_id is not null and source_id is not null)),
  check (status = 'declined' or (config is not null and public_config is not null and config_hash is not null))
);
create unique index labs_shared_topic on labs (topic_key) where owner_id is null and origin = 'topic';
create index labs_source on labs (source_id);

alter table labs enable row level security;
create policy labs_read on labs for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
-- Column privileges: the configuration with its hidden constants never reaches a client.
revoke all on labs from anon, authenticated;
grant select (id, owner_id, origin, topic_key, source_id, title, subject, status, decline_reason, public_config,
              config_hash, created_at)
  on labs to authenticated;

-- A student's labs: which labs they have, and the course they were requested or built for.
create table user_labs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  lab_id uuid not null references labs(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index user_labs_once on user_labs (user_id, lab_id, coalesce(course_id, '00000000-0000-0000-0000-000000000000'));
create index user_labs_course on user_labs (course_id);

alter table user_labs enable row level security;
create policy user_labs_own on user_labs for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on user_labs from anon, authenticated;

-- Lab runs are written by the server when the student compares their result (the server holds the
-- true value), so a run's readings and result always match the engine's for its seed.
alter table lab_runs
  add column lab_id uuid references labs(id) on delete set null,
  add column config_hash text;
create index lab_runs_user_lab on lab_runs (user_id, lab_id);
drop policy labruns_own on lab_runs;
create policy labruns_read on lab_runs for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on lab_runs from anon, authenticated;

-- The job queue, a daily allowance per student (cached topic labs are free) and the model route
-- (04 §3: a short structured call, Groq first, Gemini fallback).
select pgmq.create('lab_extract');
update app_config set value = value || '{"lab_extract": {"limit": 10}}'::jsonb where key = 'ai_quotas';
update app_config set value = value || '{"lab_extract": {"provider": "groq", "model": "openai/gpt-oss-120b", "thinking": "low"}}'::jsonb
  where key = 'ai_routes';
