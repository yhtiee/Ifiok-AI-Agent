-- P1-01 student-created courses, outlines and concepts (F2-FR1–FR3, 03 §2, 08 §2.5b).
-- All writes go through server routes with the service role; these functions are server-only.

-- ---------------------------------------------------------------------------
-- Controlled subjects (03 §2) and level bands (app_config.level_bands)
-- Sensitive subjects (F2-FR5): lessons wait for a curator before students see them.
-- ---------------------------------------------------------------------------
insert into subjects (code, title, sensitive) values
  ('mathematics', 'Mathematics', false),
  ('statistics', 'Statistics', false),
  ('physics', 'Physics', false),
  ('chemistry', 'Chemistry', false),
  ('biology', 'Biology', false),
  ('biochemistry', 'Biochemistry', false),
  ('microbiology', 'Microbiology', false),
  ('computer-science', 'Computer science', false),
  ('electrical-engineering', 'Electrical and electronic engineering', false),
  ('mechanical-engineering', 'Mechanical engineering', false),
  ('civil-engineering', 'Civil engineering', false),
  ('chemical-engineering', 'Chemical engineering', false),
  ('agriculture', 'Agriculture', false),
  ('economics', 'Economics', false),
  ('accounting', 'Accounting', false),
  ('business-administration', 'Business administration', false),
  ('banking-finance', 'Banking and finance', false),
  ('marketing', 'Marketing', false),
  ('political-science', 'Political science', false),
  ('sociology', 'Sociology', false),
  ('psychology', 'Psychology', false),
  ('geography', 'Geography', false),
  ('history', 'History', false),
  ('english', 'English and literature', false),
  ('linguistics', 'Linguistics and languages', false),
  ('philosophy', 'Philosophy', false),
  ('religious-studies', 'Religious studies', false),
  ('mass-communication', 'Mass communication', false),
  ('education', 'Education', false),
  ('architecture', 'Architecture', false),
  ('estate-management', 'Estate management', false),
  ('general-studies', 'General studies', false),
  ('law', 'Law', true),
  ('medicine', 'Medicine and surgery', true),
  ('nursing', 'Nursing', true),
  ('pharmacy', 'Pharmacy', true),
  ('other', 'Other', false)
on conflict (code) do nothing;

insert into app_config (key, value) values
  ('level_bands', '{"default":"introductory","100":"introductory","200":"intermediate","300":"intermediate","400":"advanced","500":"advanced","600":"advanced","700":"advanced"}'::jsonb)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Outline edits can wait for confirmation (08 §2.5b vandalism rules)
-- ---------------------------------------------------------------------------
alter table outline_revisions
  add column status text not null default 'applied' check (status in ('applied', 'pending', 'rejected')),
  add column decided_by uuid references profiles(id) on delete set null,
  add column decided_at timestamptz;
create index on outline_revisions (course_id, id desc);

create index if not exists courses_title_trgm on courses using gin (title extensions.gin_trgm_ops);
create index if not exists courses_university on courses (university_id, status);
create index if not exists concepts_subject_band on concepts (subject, level_band) where status = 'active';

-- ---------------------------------------------------------------------------
-- Course search and near-duplicates (F2-FR1). Similar code or title at the same university.
-- ---------------------------------------------------------------------------
create or replace function search_courses(p_university uuid, p_query text, p_limit int default 10)
returns table (id uuid, code text, title text, subject text, level smallint, members bigint, score real)
language sql stable security definer set search_path = public, extensions as $$
  with q as (
    select upper(regexp_replace(coalesce(p_query, ''), '[^A-Za-z0-9]', '', 'g')) as code_q,
           lower(trim(coalesce(p_query, ''))) as text_q
  )
  select c.id, c.code, c.title, c.subject, c.level,
         (select count(*) from enrollments e where e.course_id = c.id) as members,
         greatest(
           case when q.code_q <> '' and c.code_norm = q.code_q then 1.0
                when q.code_q <> '' and c.code_norm like q.code_q || '%' then 0.9
                else 0 end,
           similarity(lower(c.title), q.text_q),
           similarity(c.code_norm, q.code_q)
         )::real as score
  from courses c, q
  where c.university_id = p_university and c.status = 'active'
    and (q.text_q = ''
         or c.code_norm like q.code_q || '%'
         or lower(c.title) % q.text_q
         or lower(c.title) like '%' || q.text_q || '%'
         or similarity(c.code_norm, q.code_q) > 0.5)
  order by score desc, members desc, c.code
  limit greatest(1, least(p_limit, 50));
$$;

-- ---------------------------------------------------------------------------
-- Concept matching by embedding (04 §4.5b): top candidates in the same subject and level band.
-- p_subject null searches every subject (free-standing topics).
-- ---------------------------------------------------------------------------
create or replace function match_concepts(p_embedding extensions.vector(384), p_subject text, p_level_band level_band, p_limit int default 5)
returns table (id uuid, slug text, title text, subject text, description text, similarity double precision)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.slug, c.title, c.subject, c.description, 1 - (c.embedding <=> p_embedding) as similarity
  from concepts c
  where c.status = 'active' and c.embedding is not null
    and c.level_band = p_level_band
    and (p_subject is null or c.subject = p_subject)
  order by c.embedding <=> p_embedding
  limit greatest(1, least(p_limit, 10));
$$;

-- New concept with a unique slug: '-2', '-3'… appended on conflict (03 §2).
create or replace function create_concept(
  p_slug text, p_title text, p_subject text, p_level_band level_band, p_description text,
  p_micro_skills text[], p_prerequisite_hints text[], p_embedding extensions.vector(384), p_created_by uuid)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare v_id uuid; v_slug text := p_slug; v_n int := 1;
begin
  loop
    begin
      insert into concepts (slug, title, subject, level_band, description, micro_skills, prerequisite_hints, embedding, created_by)
      values (v_slug, p_title, p_subject, p_level_band, p_description, coalesce(p_micro_skills, '{}'),
              coalesce(p_prerequisite_hints, '{}'), p_embedding, p_created_by)
      returning id into v_id;
      return v_id;
    exception when unique_violation then
      v_n := v_n + 1;
      if v_n > 50 then raise; end if;
      v_slug := p_slug || '-' || v_n;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Outlines (F2-FR2): a revision holds the full ordered topic list. Applying it updates topics
-- in place, adds new ones and archives removed ones; topics are never deleted once used.
-- p_topics: [{ "topic_id"?: uuid, "concept_id": uuid, "title": text, "week"?: int, "description"?: text }]
-- ---------------------------------------------------------------------------
create or replace function apply_outline(p_course uuid, p_topics jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_item jsonb; v_pos int := 0; v_keep uuid[] := '{}'; v_id uuid;
begin
  perform 1 from courses where id = p_course for update;

  -- Free every position first (unique (course_id, position) covers archived rows too).
  update topics t set position = -r.n
  from (select id, row_number() over (order by position, created_at) as n from topics where course_id = p_course) r
  where t.id = r.id;

  for v_item in select * from jsonb_array_elements(p_topics) loop
    v_pos := v_pos + 1;
    v_id := nullif(v_item ->> 'topic_id', '')::uuid;
    if v_id is not null and exists (select 1 from topics where id = v_id and course_id = p_course) then
      update topics set position = v_pos, title = v_item ->> 'title', week = nullif(v_item ->> 'week', '')::smallint,
             description = nullif(v_item ->> 'description', ''), concept_id = (v_item ->> 'concept_id')::uuid,
             archived_at = null
       where id = v_id;
    else
      insert into topics (course_id, concept_id, week, position, title, description)
      values (p_course, (v_item ->> 'concept_id')::uuid, nullif(v_item ->> 'week', '')::smallint, v_pos,
              v_item ->> 'title', nullif(v_item ->> 'description', ''))
      returning id into v_id;
    end if;
    v_keep := v_keep || v_id;
  end loop;

  update topics set archived_at = coalesce(archived_at, now())
   where course_id = p_course and not (id = any(v_keep));
end $$;

revoke execute on function search_courses(uuid, text, int) from public, anon, authenticated;
revoke execute on function match_concepts(extensions.vector, text, level_band, int) from public, anon, authenticated;
revoke execute on function create_concept(text, text, text, level_band, text, text[], text[], extensions.vector, uuid) from public, anon, authenticated;
revoke execute on function apply_outline(uuid, jsonb) from public, anon, authenticated;
grant execute on function search_courses(uuid, text, int), match_concepts(extensions.vector, text, level_band, int),
  create_concept(text, text, text, level_band, text, text[], text[], extensions.vector, uuid), apply_outline(uuid, jsonb)
  to service_role;
