-- Retrieval RPCs (specifications/03-data-model.md §9). Service role only.
-- search_path includes `extensions` for the pgvector <=> operator.

create or replace function match_chunks(p_user uuid, p_course uuid, p_concept uuid, p_query text, p_embedding extensions.vector(384), p_limit int default 6)
returns table (id bigint, source_id uuid, page int, content text, score double precision)
language sql stable security definer set search_path = public, extensions as $$
  -- Visible chunks for this request: the caller's own private chunks, approved crowd ('bank')
  -- chunks from any university, and approved 'course' chunks of a course the caller is enrolled
  -- in. Scoped to the course and/or concept being studied. Explicit filter (no reliance on RLS)
  -- because this runs from server code with the service role.
  with visible as (
    select c.id, c.tsv, c.embedding
    from chunks c
    join sources s on s.id = c.source_id
    where ( (p_course is not null and c.course_id = p_course)
         or (p_concept is not null and c.concept_id = p_concept) )
      and ( c.owner_id = p_user
         or ( s.review = 'approved' and c.visibility = 'bank' and s.kind <> 'past_paper' )
         or ( s.review = 'approved' and c.visibility = 'course'
              and s.kind <> 'past_paper'
              and exists (select 1 from enrollments e where e.user_id = p_user and e.course_id = c.course_id) ) )
  ),
  q as (  -- OR the query words: natural-language questions rarely match every word
    select to_tsquery('english', replace(plainto_tsquery('english', p_query)::text, ' & ', ' | ')) as tsq
  ),
  fts as (
    select v.id, ts_rank(v.tsv, q.tsq) as r
    from visible v, q
    where v.tsv @@ q.tsq
    order by r desc limit 20
  ),
  vec as (
    select v.id, 1 - (v.embedding <=> p_embedding) as r
    from visible v
    where p_embedding is not null and v.embedding is not null
    order by v.embedding <=> p_embedding limit 20
  ),
  fused as (
    select id, sum(score) as score from (
      select id, 1.0 / (60 + row_number() over (order by r desc)) as score from fts
      union all
      select id, 1.0 / (60 + row_number() over (order by r desc)) as score from vec
    ) s group by id
  )
  select c.id, c.source_id, c.page, c.content, f.score
  from fused f join chunks c on c.id = f.id
  order by f.score desc
  limit p_limit;
$$;

-- The ONLY source of chunks for shared (global) lessons and their refreshes.
create or replace function shared_lesson_sources(p_concept uuid, p_limit int default 40)
returns table (id bigint, source_id uuid, page int, content text)
language sql stable security definer set search_path = public as $$
  select c.id, c.source_id, c.page, c.content
  from chunks c join sources s on s.id = c.source_id
  where c.concept_id = p_concept and c.visibility = 'bank'
    and s.review = 'approved' and s.kind <> 'past_paper'
  order by c.id
  limit p_limit;
$$;

revoke execute on function match_chunks(uuid, uuid, uuid, text, extensions.vector, int) from public, anon, authenticated;
revoke execute on function shared_lesson_sources(uuid, int) from public, anon, authenticated;
grant execute on function match_chunks(uuid, uuid, uuid, text, extensions.vector, int) to service_role;
grant execute on function shared_lesson_sources(uuid, int) to service_role;
