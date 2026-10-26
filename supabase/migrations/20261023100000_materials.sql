-- MVP-01 materials (10 MVP-01, 03 §3 and §10): a student's own course materials, read on the
-- device; only the chosen pages' text arrives (F3). Sources stay private with no storage_path; the
-- server writes chunks at once (searchable by keyword) and the `embed` job fills their embeddings.

-- Materials for a free-standing topic (no course) belong to its concept.
alter table sources add column concept_id uuid references concepts(id) on delete set null;
create index sources_owner_created on sources (owner_id, created_at desc);
create index sources_concept on sources (concept_id) where concept_id is not null;

-- The embed job's write: one batch of embeddings for chunks of one source. Service role only.
create or replace function set_chunk_embeddings(p_source uuid, p_ids bigint[], p_embeddings text[])
returns int
language sql security definer set search_path = public, extensions as $$
  with v as (
    select id, e from unnest(p_ids, p_embeddings) as t(id, e)
  ),
  u as (
    update chunks c set embedding = v.e::extensions.vector(384)
    from v
    where c.id = v.id and c.source_id = p_source
    returning 1
  )
  select count(*)::int from u;
$$;
revoke execute on function set_chunk_embeddings(uuid, bigint[], text[]) from public, anon, authenticated;
grant execute on function set_chunk_embeddings(uuid, bigint[], text[]) to service_role;

-- The Materials panel: the caller's own sources for a course or a topic, with chunk counts.
-- Security invoker, so RLS limits it to the caller's own sources and chunks.
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
    and s.visibility = 'private'
    and ((p_course is not null and s.course_id = p_course)
      or (p_concept is not null and s.concept_id = p_concept))
  group by s.id
  order by s.created_at desc;
$$;
revoke execute on function material_summaries(uuid, uuid) from public, anon;
grant execute on function material_summaries(uuid, uuid) to authenticated, service_role;
