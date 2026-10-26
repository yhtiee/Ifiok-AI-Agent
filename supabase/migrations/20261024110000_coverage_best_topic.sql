-- MVP-02 coverage calibration (12 §4 Q49). Measured on the hosted project with gte-small: a topic's
-- title against full-size note chunks scores 0.87–0.93 for the right topic but up to 0.84 for a
-- neighbouring one (projectile notes vs "Simple harmonic motion"). So a chunk now counts only for
-- the topic it matches best among the course's topics, and the threshold rises to 0.85.

create or replace function material_coverage(p_user uuid, p_course uuid, p_concept uuid, p_min_similarity double precision)
returns table (concept_id uuid, close_chunks int)
language sql stable security definer set search_path = public, extensions as $$
  with wanted as (
    select t.concept_id from topics t
    where p_course is not null and t.course_id = p_course and t.archived_at is null and t.concept_id is not null
    union
    select p_concept where p_concept is not null
  ),
  targets as (
    select k.id, k.embedding from concepts k join wanted w on w.concept_id = k.id where k.embedding is not null
  ),
  mine as (
    select c.id, c.embedding from chunks c
    where c.owner_id = p_user and c.visibility = 'private' and c.embedding is not null
      and ((p_course is not null and c.course_id = p_course) or (p_course is null and c.concept_id = p_concept))
      and exists (select 1 from sources s where s.id = c.source_id and s.kind <> 'past_paper')
  ),
  best as (  -- each chunk's closest topic
    select distinct on (m.id) m.id as chunk_id, t.id as concept_id, 1 - (m.embedding <=> t.embedding) as similarity
    from mine m cross join targets t
    order by m.id, m.embedding <=> t.embedding
  )
  select t.id, (count(b.chunk_id) filter (where b.similarity >= p_min_similarity))::int
  from targets t left join best b on b.concept_id = t.id
  group by t.id;
$$;
revoke execute on function material_coverage(uuid, uuid, uuid, double precision) from public, anon, authenticated;
grant execute on function material_coverage(uuid, uuid, uuid, double precision) to service_role;

update app_config set value = value || '{"min_similarity": 0.85}'::jsonb where key = 'private_lessons';
