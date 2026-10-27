-- MVP-06 curation helpers (F11-FR2): concept candidates and duplicate scores by embedding, and the
-- one-step approval that tags each chunk with its best topic and moves the material into the pool.
-- Server only (the `curate` job).

-- Topics the shared material is closest to: the best chunk-to-concept similarity per concept.
create or replace function curate_candidates(p_source uuid, p_limit int default 10)
returns table (concept_id uuid, title text, score double precision)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.title, max(1 - (ch.embedding <=> c.embedding)) as score
  from chunks ch
  join concepts c on c.embedding is not null and c.status = 'active'
  where ch.source_id = p_source and ch.embedding is not null
  group by c.id, c.title
  order by score desc
  limit p_limit;
$$;

-- Share of the material's chunks that nearly repeat (cosine similarity ≥ p_threshold) a chunk
-- already approved in the pool from another source. 1.0 = a re-upload of something shared.
create or replace function bank_duplicate_share(p_source uuid, p_threshold double precision default 0.92)
returns double precision
language sql stable security definer set search_path = public, extensions as $$
  with mine as (
    select id, embedding from chunks where source_id = p_source and embedding is not null
  ), hits as (
    select m.id
    from mine m
    where exists (
      select 1 from chunks b join sources s on s.id = b.source_id
      where b.source_id <> p_source and b.visibility = 'bank' and s.review = 'approved'
        and b.embedding is not null and 1 - (b.embedding <=> m.embedding) >= p_threshold
    )
  )
  select case when (select count(*) from mine) = 0 then 0
              else (select count(*) from hits)::double precision / (select count(*) from mine) end;
$$;

-- Approves shared material: each chunk gets the closest of the approved topics, the chunks and the
-- source become pool material, and the source records its topics. Returns the chunks moved.
create or replace function approve_shared_source(p_source uuid, p_concepts uuid[])
returns int language plpgsql security definer set search_path = public, extensions as $$
declare
  v_count int;
begin
  if coalesce(array_length(p_concepts, 1), 0) = 0 then raise exception 'no topics to tag'; end if;
  update chunks ch set
    concept_id = (
      select c.id from concepts c
      where c.id = any (p_concepts)
      order by case when c.embedding is null or ch.embedding is null then 1 else 0 end,
               c.embedding <=> ch.embedding
      limit 1),
    visibility = 'bank'
  where ch.source_id = p_source;
  get diagnostics v_count = row_count;
  update sources set visibility = 'bank', review = 'approved', review_reason = null, shared_concepts = p_concepts
  where id = p_source;
  return v_count;
end $$;

revoke execute on function curate_candidates(uuid, int) from public, anon, authenticated;
revoke execute on function bank_duplicate_share(uuid, double precision) from public, anon, authenticated;
revoke execute on function approve_shared_source(uuid, uuid[]) from public, anon, authenticated;
grant execute on function curate_candidates(uuid, int) to service_role;
grant execute on function bank_duplicate_share(uuid, double precision) to service_role;
grant execute on function approve_shared_source(uuid, uuid[]) to service_role;
