-- publish_lesson_version: the nullable trailing arguments get defaults, so the generated types mark
-- them optional (a lesson without a course, requester or verifying curator).
create or replace function publish_lesson_version(
  p_concept uuid,
  p_kind text,
  p_spec jsonb,
  p_status lesson_status,
  p_trust text,
  p_source_refs bigint[],
  p_sources_used int,
  p_model text default null,
  p_course uuid default null,
  p_requested_by uuid default null,
  p_verified_by uuid default null,
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

revoke execute on function publish_lesson_version(uuid, text, jsonb, lesson_status, text, bigint[], int, text, uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function publish_lesson_version(uuid, text, jsonb, lesson_status, text, bigint[], int, text, uuid, uuid, uuid, uuid)
  to service_role;
