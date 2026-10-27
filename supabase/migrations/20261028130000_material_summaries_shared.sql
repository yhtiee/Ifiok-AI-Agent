-- MVP-06: a student's materials list keeps the materials they shared. Approval moves a source into
-- the pool (visibility 'bank'), which used to drop it from its owner's own list.
create or replace function material_summaries(p_course uuid, p_concept uuid)
returns table (
  id uuid,
  kind source_kind,
  title text,
  page_count int,
  created_at timestamptz,
  chunks int,
  pending_chunks int
)
language sql stable security invoker set search_path = public as $$
  select s.id, s.kind, s.title, s.page_count, s.created_at,
         count(c.id)::int as chunks,
         count(c.id) filter (where c.embedding is null)::int as pending_chunks
  from sources s
  left join chunks c on c.source_id = s.id
  where s.owner_id = auth.uid()
    and ((p_course is not null and s.course_id = p_course)
      or (p_concept is not null and s.concept_id = p_concept))
  group by s.id
  order by s.created_at desc;
$$;
revoke execute on function material_summaries(uuid, uuid) from public, anon;
grant execute on function material_summaries(uuid, uuid) to authenticated, service_role;
