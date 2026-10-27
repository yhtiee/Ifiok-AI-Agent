-- MVP-06 contribute, teach and earn (F11, F18, F17-FR1, 06 §0, §2, §4, §14, 12 §4 Q42, Q57).
-- Sharing to the contribution pool, student explainers, usage points, Units earned (pending, no
-- cash and no naira) and tutor profiles without bookings. Every write is server-side.

-- ---------------------------------------------------------------------------
-- Sharing: a source the student shared is curated, then approved into the pool or held.
-- `shared_at` null = never shared (review stays 'pending' as before for private materials).
-- ---------------------------------------------------------------------------
alter table sources
  add column shared_at timestamptz,
  add column shared_concepts uuid[] not null default '{}';
create index sources_shared on sources (owner_id, shared_at) where shared_at is not null;

-- ---------------------------------------------------------------------------
-- Explainers (F18): text, voice or video for one concept. Nothing is visible to other students
-- until an admin approves it (every MVP explainer, Q42); media lives in a private bucket.
-- ---------------------------------------------------------------------------
create table explainers (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  kind text not null check (kind in ('text', 'voice', 'video')),
  title text not null check (char_length(title) between 3 and 120),
  body_md text check (body_md is null or char_length(body_md) <= 12000),
  media_path text,
  audio_path text,
  media_bytes int,
  audio_bytes int,
  duration_s numeric(6, 1),
  transcript text,
  captions jsonb,
  status text not null default 'uploading'
    check (status in ('uploading', 'processing', 'pending_admin', 'held', 'approved', 'rejected', 'withdrawn')),
  review_reason text,
  ai_review jsonb,
  numbers_checked boolean,
  approved_by uuid references profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'text' or audio_path is not null or status = 'uploading'),
  check (kind <> 'text' or body_md is not null)
);
create index explainers_concept on explainers (concept_id, status);
create index explainers_author on explainers (author_id, created_at desc);

alter table explainers enable row level security;
create policy explainers_read on explainers for select to authenticated
  using (author_id = auth.uid() or status = 'approved' or is_admin());
revoke insert, update, delete on explainers from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Usage points (06 §4): one per (resource, consumer, month), qualified consumers only, never
-- the contributor themselves. Written only by record_usage().
-- ---------------------------------------------------------------------------
create table usage_points (
  id bigint generated always as identity primary key,
  resource_kind text not null check (resource_kind in ('source', 'explainer')),
  resource_id uuid not null,
  contributor_id uuid not null references profiles(id) on delete cascade,
  consumer_id uuid not null references profiles(id) on delete cascade,
  month date not null,
  created_at timestamptz not null default now(),
  unique (resource_kind, resource_id, consumer_id, month),
  check (contributor_id <> consumer_id)
);
create index usage_points_contributor on usage_points (contributor_id, month);

alter table usage_points enable row level security;
create policy usage_points_read_own on usage_points for select to authenticated using (contributor_id = auth.uid());
revoke insert, update, delete on usage_points from anon, authenticated;

-- Units earned, pending until the wallet ships (E-03): append-only and idempotent on `key`.
create table earned_units_pending (
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  units int not null check (units > 0),
  reason text not null check (reason in ('upload_approved', 'consumer')),
  key text not null unique,
  month date not null,
  created_at timestamptz not null default now()
);
create index earned_units_pending_user on earned_units_pending (user_id, month);

alter table earned_units_pending enable row level security;
create policy earned_units_read_own on earned_units_pending for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on earned_units_pending from anon, authenticated;
-- Append-only even for the server: no updates or deletes.
create or replace function earned_units_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'earned_units_pending is append-only';
end $$;
create trigger earned_units_no_change before update or delete on earned_units_pending
  for each row execute function earned_units_append_only();

-- ---------------------------------------------------------------------------
-- Tutor profiles (F17-FR1, profile only): concepts and availability; no bookings or payments.
-- ---------------------------------------------------------------------------
create table tutor_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  availability text not null check (char_length(availability) between 3 and 300),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
create table tutor_concepts (
  user_id uuid not null references tutor_profiles(user_id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  primary key (user_id, concept_id)
);
create index tutor_concepts_concept on tutor_concepts (concept_id);

alter table tutor_profiles enable row level security;
alter table tutor_concepts enable row level security;
create policy tutor_profiles_read on tutor_profiles for select to authenticated using (active or user_id = auth.uid());
create policy tutor_concepts_read on tutor_concepts for select to authenticated
  using (exists (select 1 from tutor_profiles t where t.user_id = tutor_concepts.user_id and (t.active or t.user_id = auth.uid())));
revoke insert, update, delete on tutor_profiles, tutor_concepts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Units and usage functions (06 §2, §4). Server only.
-- ---------------------------------------------------------------------------

-- Awards pending Units under the monthly cap; returns the Units actually added (0 when capped or
-- the key was already used).
create or replace function award_pending_units(p_user uuid, p_units int, p_reason text, p_key text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
  v_cap int := coalesce((select (value ->> 'earned_units_monthly_cap')::int from app_config where key = 'usage'), 40);
  v_used int;
  v_units int;
begin
  if p_units <= 0 then return 0; end if;
  -- One award per user at a time, so two awards can't both slip under the cap.
  perform pg_advisory_xact_lock(hashtext('earned_units:' || p_user::text));
  if exists (select 1 from earned_units_pending where key = p_key) then return 0; end if;
  select coalesce(sum(units), 0) into v_used from earned_units_pending where user_id = p_user and month = v_month;
  v_units := least(p_units, v_cap - v_used);
  if v_units <= 0 then return 0; end if;
  insert into earned_units_pending (user_id, units, reason, key, month) values (p_user, v_units, p_reason, p_key, v_month);
  return v_units;
end $$;
revoke execute on function award_pending_units(uuid, int, text, text) from public, anon, authenticated;
grant execute on function award_pending_units(uuid, int, text, text) to service_role;

-- A qualified consumer (06 §4): thresholds from app_config.usage (demo values during the
-- hackathon, Q57; reset to 3 days / 3 sessions / verified email before launch).
create or replace function is_qualified_consumer(p_user uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  cfg jsonb := coalesce((select value from app_config where key = 'usage'), '{}'::jsonb);
  v_days int := coalesce((cfg ->> 'min_account_days')::int, 3);
  v_sessions int := coalesce((cfg ->> 'min_sessions_14d')::int, 3);
  v_verified boolean := coalesce((cfg ->> 'require_email_verified')::boolean, true);
begin
  return exists (
    select 1 from profiles p join auth.users u on u.id = p.id
    where p.id = p_user and p.status = 'active' and p.is_adult
      and u.created_at <= now() - make_interval(days => v_days)
      and (not v_verified or u.email_confirmed_at is not null)
  ) and coalesce((
    select sum(sessions) from daily_activity
    where user_id = p_user and day >= (now() at time zone 'Africa/Lagos')::date - 13
  ), 0) >= v_sessions;
end $$;
revoke execute on function is_qualified_consumer(uuid) from public, anon, authenticated;
grant execute on function is_qualified_consumer(uuid) to service_role;

-- One usage point per (resource, consumer, month); +1 pending Unit per new (contributor,
-- consumer, month) pair across all of a contributor's resources (Q57). Returns whether a point
-- was recorded. Self-use, unapproved resources and unqualified consumers record nothing.
create or replace function record_usage(p_kind text, p_resource uuid, p_consumer uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_contributor uuid;
  v_month date := date_trunc('month', now() at time zone 'Africa/Lagos')::date;
  v_inserted int;
begin
  if p_kind = 'source' then
    select owner_id into v_contributor from sources
      where id = p_resource and visibility = 'bank' and review = 'approved';
  elsif p_kind = 'explainer' then
    select author_id into v_contributor from explainers where id = p_resource and status = 'approved';
  else
    raise exception 'unknown resource kind %', p_kind;
  end if;
  if v_contributor is null or v_contributor = p_consumer then return false; end if;
  if not is_qualified_consumer(p_consumer) then return false; end if;

  insert into usage_points (resource_kind, resource_id, contributor_id, consumer_id, month)
  values (p_kind, p_resource, v_contributor, p_consumer, v_month)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then return false; end if;

  perform award_pending_units(v_contributor, 1, 'consumer',
    'consumer:' || v_contributor || ':' || p_consumer || ':' || to_char(v_month, 'YYYY-MM'));
  return true;
end $$;
revoke execute on function record_usage(text, uuid, uuid) from public, anon, authenticated;
grant execute on function record_usage(text, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Explainer media: a private bucket; every read and write goes through short-lived signed URLs
-- made on the server (08 §2.5c). Guarded so local PGlite tests without Storage still run.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('explainers', 'explainers', false, 42 * 1024 * 1024,
            array['video/webm', 'video/mp4', 'audio/webm', 'audio/mp4', 'audio/ogg'])
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Jobs, allowances, routes and settings.
-- ---------------------------------------------------------------------------
select pgmq.create('explainer');

insert into app_config (key, value) values
  ('usage', '{"min_account_days": 0, "min_sessions_14d": 1, "require_email_verified": true,
              "earned_units_monthly_cap": 40, "approved_upload_units": 5}'::jsonb),
  ('audio_prices', '[{"provider": "groq", "model": "whisper-large-v3-turbo", "usd_per_hour": 0.04,
                      "effective_from": "2026-01-01"}]'::jsonb)
on conflict (key) do nothing;

update app_config set value = value || '{"explainers": {"limit": 10}, "transcribe": {"limit": 10}}'::jsonb
  where key = 'ai_quotas';
update app_config set value = value || '{
  "curate_classify": {"provider": "groq", "model": "openai/gpt-oss-20b", "thinking": "low"},
  "explainer_review": {"provider": "groq", "model": "openai/gpt-oss-20b", "thinking": "low"},
  "explainer_frames": {"provider": "gemini", "model": "gemini-3.5-flash", "thinking": "low"},
  "transcribe": {"provider": "groq", "model": "whisper-large-v3-turbo"}
}'::jsonb where key = 'ai_routes';
