-- MVP-02 learning path from your materials (10 MVP-02, 12 §4 Q49): which outline topics a
-- student's own materials cover, the chunks that ground their private lesson, private lesson
-- versions, and practice items that students only ever see once published.

-- A topic is covered when enough of the student's own chunks are close to its concept. No AI call:
-- chunk embeddings against the concept's embedding. Past questions are left out (exam prep, MVP-04).
-- Course scope uses the course's chunks; a free-standing topic uses the chunks filed under it.
create or replace function material_coverage(p_user uuid, p_course uuid, p_concept uuid, p_min_similarity double precision)
returns table (concept_id uuid, close_chunks int)
language sql stable security definer set search_path = public, extensions as $$
  with wanted as (
    select t.concept_id from topics t
    where p_course is not null and t.course_id = p_course and t.archived_at is null and t.concept_id is not null
    union
    select p_concept where p_concept is not null
  )
  select w.concept_id,
         count(c.id) filter (where 1 - (c.embedding <=> k.embedding) >= p_min_similarity)::int
  from wanted w
  join concepts k on k.id = w.concept_id
  left join chunks c
    on c.owner_id = p_user and c.visibility = 'private' and c.embedding is not null
   and ((p_course is not null and c.course_id = p_course) or (p_course is null and c.concept_id = w.concept_id))
   and exists (select 1 from sources s where s.id = c.source_id and s.kind <> 'past_paper')
  where k.embedding is not null
  group by w.concept_id;
$$;

-- The student's own chunks for one topic, closest first: the only source of a private lesson.
create or replace function private_lesson_sources(p_user uuid, p_course uuid, p_concept uuid,
                                                  p_min_similarity double precision, p_limit int default 12)
returns table (id bigint, source_id uuid, page int, content text, similarity double precision)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.source_id, c.page, c.content, 1 - (c.embedding <=> k.embedding) as similarity
  from concepts k
  join chunks c
    on c.owner_id = p_user and c.visibility = 'private' and c.embedding is not null
   and ((p_course is not null and c.course_id = p_course) or (p_course is null and c.concept_id = p_concept))
  join sources s on s.id = c.source_id and s.kind <> 'past_paper'
  where k.id = p_concept and k.embedding is not null
    and 1 - (c.embedding <=> k.embedding) >= p_min_similarity
  order by c.embedding <=> k.embedding
  limit p_limit;
$$;

-- Insert the next version of a student's private lesson for a concept (in a course, or alone).
-- When it is published, their earlier published version becomes 'superseded'. The shared lesson
-- and concepts.current_lesson_id are never touched.
create or replace function publish_private_lesson(
  p_owner uuid,
  p_concept uuid,
  p_course uuid,
  p_spec jsonb,
  p_status lesson_status,
  p_source_refs bigint[],
  p_sources_used int,
  p_model text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_version int; v_id uuid;
begin
  if p_status not in ('review','published') then
    raise exception 'publish_private_lesson only writes review or published lessons';
  end if;
  perform 1 from profiles where id = p_owner for update;
  if not found then raise exception 'owner % not found', p_owner; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from lessons where owner_id = p_owner and concept_id = p_concept and course_id is not distinct from p_course;

  insert into lessons (concept_id, course_id, owner_id, requested_by, kind, version, status, dsl_version, spec,
                       source_refs, sources_used, trust, model, published_at)
  values (p_concept, p_course, p_owner, p_owner, 'topic', v_version, p_status, 1, p_spec,
          coalesce(p_source_refs, '{}'), coalesce(p_sources_used, 0), 'new', p_model,
          case when p_status = 'published' then now() end)
  returning id into v_id;

  if p_status = 'published' then
    update lessons set status = 'superseded'
    where owner_id = p_owner and concept_id = p_concept and course_id is not distinct from p_course
      and id <> v_id and status = 'published';
  end if;
  return v_id;
end $$;

create index lessons_private_lookup on lessons (owner_id, concept_id, course_id) where owner_id is not null;

revoke execute on function material_coverage(uuid, uuid, uuid, double precision) from public, anon, authenticated;
revoke execute on function private_lesson_sources(uuid, uuid, uuid, double precision, int) from public, anon, authenticated;
revoke execute on function publish_private_lesson(uuid, uuid, uuid, jsonb, lesson_status, bigint[], int, text)
  from public, anon, authenticated;
grant execute on function material_coverage(uuid, uuid, uuid, double precision),
  private_lesson_sources(uuid, uuid, uuid, double precision, int),
  publish_private_lesson(uuid, uuid, uuid, jsonb, lesson_status, bigint[], int, text)
  to service_role;

-- Practice items: students see only published items, their own included. An item that failed its
-- checks never reaches a student (10 MVP-02 "Done when"); admins still see everything.
drop policy items_read on items;
create policy items_read on items for select using (
  (status = 'published' and ((owner_id is null and is_adult_active()) or owner_id = auth.uid())) or is_admin());

-- Pilot settings (12 §4 Q49): 30 private lessons a day per student; coverage needs 3 close chunks.
-- min_similarity is calibrated on gte-small (chunk text against a concept's title + description).
update app_config set value = value || '{"private_lesson": {"limit": 30}}'::jsonb where key = 'ai_quotas';
insert into app_config (key, value) values
  ('private_lessons', '{"min_similarity": 0.80, "min_chunks": 3, "max_chunks": 12, "items_per_topic": 10}')
on conflict (key) do nothing;
