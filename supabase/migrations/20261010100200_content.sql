-- 0003 sources, chunks, lessons, items (specifications/03-data-model.md §3) with their RLS (§8).

create table sources (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete set null,
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
create unique index sources_dedupe_bank on sources (sha256) where sha256 is not null and visibility = 'bank';
create unique index sources_dedupe_course on sources (course_id, sha256) where sha256 is not null and visibility = 'course';

create table chunks (
  id bigint generated always as identity primary key,
  source_id uuid not null references sources(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  course_id uuid references courses(id) on delete cascade,
  concept_id uuid references concepts(id) on delete set null,
  visibility source_visibility not null,
  page int,
  content text not null,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  embedding extensions.vector(384),
  created_at timestamptz not null default now()
);
create index on chunks using gin (tsv);
-- No HNSW index in P0–P2: exact scan filtered by course/concept (03 §3).
create index on chunks (course_id, visibility);
create index on chunks (concept_id, visibility);
create index on chunks (owner_id);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references concepts(id),
  course_id uuid references courses(id) on delete set null,
  owner_id uuid references profiles(id) on delete cascade,      -- null = shared lesson
  requested_by uuid references profiles(id) on delete set null,
  kind text not null default 'topic' check (kind in ('topic','preview','micro','tutor_inline')),
  version int not null default 1,
  status lesson_status not null default 'draft',
  dsl_version smallint not null,
  spec jsonb not null,
  source_refs bigint[] not null default '{}',
  hidden_blocks text[] not null default '{}',
  trust text not null default 'new' check (trust in ('new','trusted')),
  completions int not null default 0,
  sources_used int not null default 0,
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
  course_id uuid references courses(id) on delete set null,
  lesson_id uuid references lessons(id) on delete set null,
  block_id text,
  owner_id uuid references profiles(id) on delete cascade,
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
  status lesson_status not null default 'review',
  created_at timestamptz not null default now()
);
create index on items (concept_id, status, difficulty);
create unique index items_checkpoint on items (lesson_id, block_id) where lesson_id is not null;

create table exam_questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  source_id uuid not null references sources(id) on delete cascade,
  year smallint,
  number text,
  text_latex text not null,
  marks numeric(5,2),
  qtype text check (qtype in ('calc','theory','definition','proof','diagram','mcq')),
  concept_id uuid references concepts(id),
  concept_confidence numeric(3,2),
  item_id uuid references items(id),
  created_at timestamptz not null default now()
);
create index on exam_questions (course_id, concept_id);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

alter table sources enable row level security;
-- Clients read only their own sources. Crowd material reaches others through the server only.
create policy sources_read on sources for select using (owner_id = auth.uid() or is_admin());
-- Clients may create private sources and rename them; review, visibility, lecturer flag and
-- licence fields are set only by server code.
revoke insert, update, delete on sources from authenticated, anon;
grant insert (id, owner_id, course_id, kind, title, sha256, page_count) on sources to authenticated;
grant update (title) on sources to authenticated;
create policy sources_insert on sources for insert with check (
  owner_id = auth.uid() and is_adult_active()
  and kind in ('textbook_private','notes','past_paper','lab_manual','solution')
  and visibility = 'private' and review = 'pending' and not is_lecturer_source and storage_path is null);
create policy sources_update_own on sources for update using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table chunks enable row level security;
-- Clients read only their own chunks. Server code uses match_chunks and shared_lesson_sources.
create policy chunks_read on chunks for select using (owner_id = auth.uid());
revoke insert, update, delete on chunks from authenticated, anon;

alter table lessons enable row level security;
-- Private lessons: owner only (not lecturers, not admins). Shared lessons: any active adult
-- reads published ones; admins and curators also see lessons in review.
create policy lessons_read on lessons for select using (
  (owner_id is null and status in ('published','superseded') and is_adult_active())
  or owner_id = auth.uid()
  or (owner_id is null and (is_admin() or is_curator(concept_id))));
-- No client writes: edits go through /api/lessons/:id (verification gate + admin_audit).
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
revoke execute on function hide_flagged_block() from public, anon, authenticated;
create trigger lesson_flags_hide after insert on lesson_flags
  for each row execute function hide_flagged_block();

alter table lesson_flags enable row level security;
create policy flags_insert on lesson_flags for insert with check (user_id = auth.uid() and resolved_at is null);
create policy flags_read on lesson_flags for select using (user_id = auth.uid() or is_admin());
revoke update, delete on lesson_flags from authenticated, anon;

alter table lesson_progress enable row level security;   -- UI resume state only; never used for rewards
create policy progress_own on lesson_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table items enable row level security;
create policy items_read on items for select using (
  (owner_id is null and status = 'published' and is_adult_active()) or owner_id = auth.uid() or is_admin());
revoke insert, update, delete on items from authenticated, anon;

alter table exam_questions enable row level security;
create policy eq_read on exam_questions for select using (is_member(course_id) or is_admin());
revoke insert, update, delete on exam_questions from authenticated, anon;
