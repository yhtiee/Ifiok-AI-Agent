-- 0004 learning activity and planning (specifications/03-data-model.md §4) with their RLS (§8).
-- Learning evidence (attempts, screen events, review cards, mastery, daily_activity) is written
-- by /api/sync with the service role only (CLAUDE.md guardrail 6).

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

create table mastery (
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
  week_range int4range,
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

create table tutor_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  title text not null default '',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tutor_threads (user_id, updated_at desc);

create table tutor_messages (
  id bigint generated always as identity primary key,
  thread_id uuid not null references tutor_threads(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content jsonb not null,
  grounded boolean,
  created_at timestamptz not null default now()
);
create index on tutor_messages (thread_id, id);

create table screen_events (
  id uuid primary key,                                   -- client-generated (idempotent sync)
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  screen_id text not null,
  completed_at timestamptz not null,
  received_at timestamptz not null default now()
);
create index on screen_events (user_id, received_at desc);

create table daily_activity (
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null,
  sessions smallint not null default 0,
  events int not null default 0,
  last_event_at timestamptz,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table attempts enable row level security;
create policy attempts_read_own on attempts for select using (user_id = auth.uid());
revoke insert, update, delete on attempts from authenticated, anon;

alter table review_cards enable row level security;
create policy cards_read_own on review_cards for select using (user_id = auth.uid());
revoke insert, update, delete on review_cards from authenticated, anon;

alter table mastery enable row level security;
create policy mastery_read_own on mastery for select using (user_id = auth.uid());
revoke insert, update, delete on mastery from authenticated, anon;

alter table goals enable row level security;
create policy goals_own on goals for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table plan_tasks enable row level security;
create policy tasks_read_own on plan_tasks for select using (user_id = auth.uid());
-- Clients may only skip a task; completion is set by /api/sync from server evidence.
revoke insert, update, delete on plan_tasks from authenticated, anon;
grant update (status) on plan_tasks to authenticated;
create policy tasks_skip_own on plan_tasks for update using (user_id = auth.uid() and status = 'planned')
  with check (user_id = auth.uid() and status = 'skipped');

alter table plan_events enable row level security;
create policy pe_own on plan_events for select using (user_id = auth.uid());
revoke insert, update, delete on plan_events from authenticated, anon;

alter table lab_runs enable row level security;
create policy labruns_own on lab_runs for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table submissions enable row level security;
create policy subs_read_own on submissions for select using (user_id = auth.uid());
revoke insert, update, delete on submissions from authenticated, anon;

alter table timetable_entries enable row level security;
create policy tt_read on timetable_entries for select using (
  (owner_id is null and is_member(course_id)) or owner_id = auth.uid());
create policy tt_write_own on timetable_entries for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and created_by = auth.uid());

alter table push_subscriptions enable row level security;
create policy push_own on push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table tutor_threads enable row level security;
create policy threads_own on tutor_threads for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table tutor_messages enable row level security;
create policy tmsg_read_own on tutor_messages for select using (user_id = auth.uid());
revoke insert, update, delete on tutor_messages from authenticated, anon;

alter table screen_events enable row level security;
create policy se_read_own on screen_events for select using (user_id = auth.uid());
revoke insert, update, delete on screen_events from authenticated, anon;

alter table daily_activity enable row level security;
create policy da_read_own on daily_activity for select using (user_id = auth.uid());
revoke insert, update, delete on daily_activity from authenticated, anon;
