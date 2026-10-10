-- 0002 people, courses, consent (specifications/03-data-model.md §2) with their RLS (§8).
-- Additions to the spec, recorded in 12 §4 Q15: profiles.onboarded_at, the updated_at trigger,
-- and handle_new_user (a profile row for every auth user).

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
  onboarded_at timestamptz,                              -- set by the server when onboarding finishes
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

-- Controlled subject list (seeded; admins add more).
create table subjects (
  code text primary key,
  title text not null,
  sensitive boolean not null default false                -- health and law: lessons need a curator before publishing (F2-FR5)
);

-- Courses are created by students on demand via /api/courses. Nothing is pre-loaded.
create table courses (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references universities(id),
  code text not null,
  code_norm text generated always as (upper(regexp_replace(code, '[^A-Za-z0-9]', '', 'g'))) stored,
  title text not null,
  subject text references subjects(code),
  outline_locked boolean not null default false,
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

-- Concepts are global and cross-university; lessons, items and mastery attach to them.
create table concepts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  subject text not null references subjects(code),
  level_band level_band not null,
  description text,
  micro_skills text[] not null default '{}',
  prerequisite_hints text[] not null default '{}',
  listed boolean not null default false,
  embedding extensions.vector(384),
  current_lesson_id uuid,                                 -- FK added in 0003 once lessons exists
  created_by uuid references profiles(id) on delete set null,
  status text not null default 'active' check (status in ('active','merged','blocked')),
  merged_into uuid references concepts(id),
  created_at timestamptz not null default now(),
  unique (slug, level_band)
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  concept_id uuid not null references concepts(id),
  week smallint,
  position int not null,
  title text not null,
  description text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (course_id, position)
);

create table outline_revisions (
  id bigint generated always as identity primary key,
  course_id uuid not null references courses(id) on delete cascade,
  editor_id uuid references profiles(id) on delete set null,
  source text not null check (source in ('upload','typed','ai_draft','edit','revert')),
  outline jsonb not null,
  created_at timestamptz not null default now()
);

create table concept_follows (
  user_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create table course_terms (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  session text not null,
  semester smallint not null check (semester in (1,2)),
  starts_on date not null,
  current_week_override smallint,
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

create table curators (
  user_id uuid not null references profiles(id) on delete cascade,
  subject text not null references subjects(code),
  approved_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, subject)
);

-- ---------------------------------------------------------------------------
-- Profiles: created for every auth user, kept current
-- ---------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Every auth user gets a profile. It starts not adult: the server sets birth_* and is_adult
-- after the date-of-birth step, and deletes the auth user (cascading here) if under 18.
-- Only a display name is copied from the provider; never the email (data minimisation, 08 §4).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 60))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS helpers (03 §8)
-- ---------------------------------------------------------------------------

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

-- Trigger functions are never called directly.
revoke execute on function handle_new_user() from public, anon, authenticated;
revoke execute on function set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

-- Display names for wiki history and curator credits (no other profile fields).
create view public_profiles with (security_invoker = false) as
  select id, display_name from profiles where status = 'active';
revoke all on public_profiles from anon, public;
grant select on public_profiles to authenticated;

alter table profiles enable row level security;
create policy profiles_self_read on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_update on profiles for update using (id = auth.uid())
  with check (id = auth.uid());
-- role, status, is_adult, birth_*, onboarded_at are changed only by server code (column grants).
revoke insert, update, delete on profiles from authenticated, anon;
grant update (display_name, university_id, department, level, daily_minutes, data_saver, locale)
  on profiles to authenticated;

alter table consents enable row level security;
create policy consents_own on consents for select using (user_id = auth.uid());
-- consents are recorded by the server (onboarding, settings).
revoke insert, update, delete on consents from authenticated, anon;

alter table universities enable row level security;
create policy uni_read on universities for select using (true);
revoke insert, update, delete on universities from authenticated, anon;

alter table subjects enable row level security;
create policy subjects_read on subjects for select using (true);
revoke insert, update, delete on subjects from authenticated, anon;

alter table curators enable row level security;
create policy curators_read_own on curators for select using (user_id = auth.uid() or is_admin());
revoke insert, update, delete on curators from authenticated, anon;

alter table micro_skills enable row level security;
create policy ms_read on micro_skills for select using (true);
revoke insert, update, delete on micro_skills from authenticated, anon;

alter table courses enable row level security;
create policy courses_read on courses for select using (auth.uid() is not null);
-- Courses are created through /api/courses (dedupe, moderation, rate limit); no direct client insert.
revoke insert, update, delete on courses from authenticated, anon;

alter table concepts enable row level security;
create policy concepts_read on concepts for select using (auth.uid() is not null and status <> 'blocked');
-- concepts are created by the topic_resolve step on the server only.
revoke insert, update, delete on concepts from authenticated, anon;

alter table concept_prereqs enable row level security;
create policy cp_read on concept_prereqs for select using (auth.uid() is not null);
revoke insert, update, delete on concept_prereqs from authenticated, anon;

alter table concept_follows enable row level security;
create policy follows_own on concept_follows for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table outline_revisions enable row level security;
create policy outline_rev_read on outline_revisions for select using (is_member(course_id) or is_admin());
revoke insert, update, delete on outline_revisions from authenticated, anon;

alter table topics enable row level security;
create policy topics_read on topics for select using (auth.uid() is not null);
-- Outline edits go through /api/courses/:id/outline (server). No direct client writes.
revoke insert, update, delete on topics from authenticated, anon;

alter table enrollments enable row level security;
create policy enroll_self on enrollments for select using (user_id = auth.uid() or is_admin());
create policy enroll_insert_self on enrollments for insert
  with check (user_id = auth.uid() and role = 'student' and not verified and is_adult_active());
create policy enroll_delete_self on enrollments for delete using (user_id = auth.uid());
revoke update on enrollments from authenticated, anon;

alter table course_terms enable row level security;
create policy terms_read on course_terms for select using (is_member(course_id) or is_admin());
-- course_terms writes: reps/lecturers/admins through a server route.
revoke insert, update, delete on course_terms from authenticated, anon;
