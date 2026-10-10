-- 0005 platform: jobs, AI usage, config, moderation (specifications/03-data-model.md §5) with RLS (§8).
-- enqueue_job's pgmq send and the worker trigger are added in P0-11.

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
  feature text not null,
  prompt_version smallint,
  provider text not null,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  thinking_tokens int not null default 0,
  tool_rounds smallint not null default 0,
  cost_micros bigint not null,
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

-- Waitlist for adults we can't serve yet. Never used for under-18s (08 §3).
create table waitlist (
  email text primary key,
  reason text not null check (reason in ('university_not_supported')),
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

-- Job enqueue. Server-only: user-facing enqueues go through /api/jobs/enqueue.
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
  -- P0-11: perform pgmq.send(p_queue, jsonb_build_object('job_id', v_id)); a trigger calls the worker.
  return v_id;
end $$;

revoke execute on function consume_quota(uuid, text, int) from public, anon, authenticated;
revoke execute on function refund_quota(uuid, text) from public, anon, authenticated;
revoke execute on function enqueue_job(text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function consume_quota(uuid, text, int), refund_quota(uuid, text),
  enqueue_job(text, jsonb, text, uuid) to service_role;

-- Merging duplicate concepts (admin only, MFA, audited; called from the admin merge tool).
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

-- ---------------------------------------------------------------------------
-- Policies: admin-only and server-only tables keep RLS on with no user policies
-- (the service role bypasses RLS).
-- ---------------------------------------------------------------------------

alter table jobs enable row level security;
create policy jobs_read_own on jobs for select using (owner_id = auth.uid() or is_admin());
revoke insert, update, delete on jobs from authenticated, anon;

alter table ai_calls enable row level security;
revoke all on ai_calls from authenticated, anon;

alter table daily_usage enable row level security;
create policy usage_read_own on daily_usage for select using (user_id = auth.uid());
revoke insert, update, delete on daily_usage from authenticated, anon;

alter table app_config enable row level security;
create policy config_read on app_config for select using (auth.uid() is not null);
revoke insert, update, delete on app_config from authenticated, anon;

alter table admin_audit enable row level security;
revoke all on admin_audit from authenticated, anon;

alter table waitlist enable row level security;   -- server-only
revoke all on waitlist from authenticated, anon;

alter table reports enable row level security;
create policy reports_insert on reports for insert with check (reporter_id = auth.uid() and status = 'open');
revoke update, delete on reports from authenticated, anon;
