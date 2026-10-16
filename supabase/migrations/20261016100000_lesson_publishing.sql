-- P1-02 blockers: one lesson_gen run per concept, quota charged only for a new job, and lesson
-- versions published atomically (F2-FR4–FR6, 02 §"Learning a new concept").

-- Like enqueue_job, but says whether this call created the job. The caller charges the
-- new_lesson quota only when created = true (a student who joins someone else's job pays nothing).
create or replace function enqueue_job_once(p_queue text, p_payload jsonb, p_dedupe text, p_owner uuid default null)
returns table (job_id uuid, created boolean) language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into jobs (queue, owner_id, dedupe_key, payload) values (p_queue, p_owner, p_dedupe, p_payload)
  on conflict (dedupe_key) where status in ('queued','running') do nothing
  returning id into v_id;
  if v_id is not null then
    return query select v_id, true;
    return;
  end if;
  return query select j.id, false from jobs j where j.dedupe_key = p_dedupe and j.status in ('queued','running');
end $$;

-- Claim a queued job for one runner. A run that has been 'running' longer than p_stale_seconds
-- is treated as crashed and can be claimed again (P0-11's visibility timeout replaces this).
-- Returns null when another runner holds the job or it has finished.
create or replace function claim_job(p_job uuid, p_stale_seconds int default 600)
returns jobs language sql security definer set search_path = public as $$
  update jobs set status = 'running', attempts = attempts + 1, updated_at = now()
  where id = p_job
    and (status = 'queued' or (status = 'running' and updated_at < now() - make_interval(secs => p_stale_seconds)))
  returning *;
$$;

-- Insert the next version of a shared lesson in one transaction. When it is published, every
-- earlier published version of the same concept and kind becomes 'superseded' (still readable, so
-- progress keeps its version) and the concept points at the new one. p_supersede also retires a
-- specific earlier version (e.g. the 'review' lesson a curator fixed).
create or replace function publish_lesson_version(
  p_concept uuid,
  p_kind text,
  p_spec jsonb,
  p_status lesson_status,
  p_trust text,
  p_source_refs bigint[],
  p_sources_used int,
  p_model text,
  p_course uuid,
  p_requested_by uuid,
  p_verified_by uuid,
  p_supersede uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_version int; v_id uuid;
begin
  if p_status not in ('review','published') then
    raise exception 'publish_lesson_version only writes review or published lessons';
  end if;
  -- Serialise versions per concept.
  perform 1 from concepts where id = p_concept for update;
  if not found then raise exception 'concept % not found', p_concept; end if;

  select coalesce(max(version), 0) + 1 into v_version
  from lessons where concept_id = p_concept and kind = p_kind and owner_id is null;

  insert into lessons (concept_id, course_id, owner_id, requested_by, kind, version, status, dsl_version, spec,
                       source_refs, sources_used, trust, model, verified_by, published_at)
  values (p_concept, p_course, null, p_requested_by, p_kind, v_version, p_status, 1, p_spec,
          coalesce(p_source_refs, '{}'), coalesce(p_sources_used, 0), p_trust, p_model, p_verified_by,
          case when p_status = 'published' then now() end)
  returning id into v_id;

  if p_status = 'published' then
    update lessons set status = 'superseded'
    where concept_id = p_concept and kind = p_kind and owner_id is null and id <> v_id
      and (status = 'published' or id = p_supersede);
    update concepts set current_lesson_id = v_id where id = p_concept;
  end if;
  return v_id;
end $$;

revoke execute on function enqueue_job_once(text, jsonb, text, uuid) from public, anon, authenticated;
revoke execute on function claim_job(uuid, int) from public, anon, authenticated;
revoke execute on function publish_lesson_version(uuid, text, jsonb, lesson_status, text, bigint[], int, text, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function enqueue_job_once(text, jsonb, text, uuid), claim_job(uuid, int),
  publish_lesson_version(uuid, text, jsonb, lesson_status, text, bigint[], int, text, uuid, uuid, uuid, uuid)
  to service_role;

-- claim_check is library work (it runs inside lesson_gen), so it spends the library budget.
-- Owner decision (12 §4 Q31): new_lesson stays at 100 per day during the free-tier pilot.
