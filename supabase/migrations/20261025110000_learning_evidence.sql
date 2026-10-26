-- MVP-03 learning evidence (10 MVP-03, F5-FR4, guardrail 6, 12 §4 Q52). POST /api/sync re-grades
-- every answer on the server, then records it here: one attempt per client UUID (replays change
-- nothing) and the concept's mastery updated in the same statement, so two answers arriving at once
-- can't overwrite each other. Service role only: clients never write evidence.

-- Mastery (F5-FR4): correct m ← m + (1−m)·0.18·w; wrong m ← m − m·0.22·w; w = 0.7 / 1.0 / 1.3 for
-- difficulty 1 / 2 / 3. Levels: Familiar m ≥ 0.30, Proficient m ≥ 0.60, Mastered m ≥ 0.85 plus a
-- correct answer at least 3 days after first reaching Proficient (the spaced check, until FSRS
-- reviews arrive in Grow). Mastered stays while m ≥ 0.85.
create or replace function record_attempt(
  p_id uuid,
  p_user uuid,
  p_item uuid,
  p_response jsonb,
  p_correct boolean,
  p_duration_ms int default null
) returns table (inserted boolean, concept_id uuid, m numeric, level text)
language plpgsql security definer set search_path = public as $$
declare
  v_concept uuid;
  v_weight numeric;
  v_old record;
  v_m numeric;
  v_level text;
  v_proficient_at timestamptz;
begin
  select i.concept_id, case i.difficulty when 1 then 0.7 when 3 then 1.3 else 1.0 end
    into v_concept, v_weight
  from items i where i.id = p_item;
  if v_concept is null then raise exception 'item % not found', p_item; end if;

  insert into attempts (id, user_id, item_id, response, correct, duration_ms)
  values (p_id, p_user, p_item, p_response, p_correct, p_duration_ms)
  on conflict (id) do nothing;

  if not found then
    -- A replay: nothing changes; report the current mastery.
    return query
      select false, v_concept, coalesce(ms.m, 0)::numeric, coalesce(ms.level, 'not_started')
      from (select 1) one left join mastery ms on ms.user_id = p_user and ms.concept_id = v_concept;
    return;
  end if;

  -- Lock (or create) this student's mastery row for the concept.
  insert into mastery (user_id, concept_id) values (p_user, v_concept) on conflict do nothing;
  select ms.m, ms.level, ms.proficient_at into v_old
  from mastery ms where ms.user_id = p_user and ms.concept_id = v_concept for update;

  v_m := case when p_correct then v_old.m + (1 - v_old.m) * 0.18 * v_weight
              else v_old.m - v_old.m * 0.22 * v_weight end;
  v_m := round(least(1, greatest(0, v_m)), 3);

  v_proficient_at := case when v_m < 0.60 then null else coalesce(v_old.proficient_at, now()) end;
  v_level := case
    when v_m >= 0.85 and (v_old.level = 'mastered'
                          or (p_correct and v_old.proficient_at is not null
                              and v_old.proficient_at <= now() - interval '3 days')) then 'mastered'
    when v_m >= 0.60 then 'proficient'
    when v_m >= 0.30 then 'familiar'
    else 'not_started'
  end;

  update mastery set m = v_m, level = v_level, proficient_at = v_proficient_at,
                     attempts_count = attempts_count + 1, updated_at = now()
  where user_id = p_user and mastery.concept_id = v_concept;

  return query select true, v_concept, v_m, v_level;
end $$;

-- A finished lesson screen: one row per client UUID, and the day's activity (Lagos time). A gap of
-- more than 30 minutes since the last event starts a new session.
create or replace function record_screen(p_id uuid, p_user uuid, p_lesson uuid, p_screen text, p_completed_at timestamptz)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_day date := (now() at time zone 'Africa/Lagos')::date;
begin
  insert into screen_events (id, user_id, lesson_id, screen_id, completed_at)
  values (p_id, p_user, p_lesson, p_screen, least(p_completed_at, now()))
  on conflict (id) do nothing;
  if not found then return false; end if;

  insert into daily_activity (user_id, day, sessions, events, last_event_at)
  values (p_user, v_day, 1, 1, now())
  on conflict (user_id, day) do update set
    events = daily_activity.events + 1,
    sessions = daily_activity.sessions
               + case when daily_activity.last_event_at < now() - interval '30 minutes' then 1 else 0 end,
    last_event_at = now();
  return true;
end $$;

-- The error tag for a wrong answer (explain_error), from the topic's micro-skills or "unknown". The
-- vocabulary grows as concepts bring their micro-skill codes; only the student's own wrong, untagged
-- attempt can be tagged.
create or replace function tag_attempt(p_attempt uuid, p_user uuid, p_tag text, p_subject text, p_title text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_tag is null or length(p_tag) = 0 or length(p_tag) > 80 then return false; end if;
  insert into micro_skills (code, subject, title) values (p_tag, coalesce(p_subject, 'general'), left(p_title, 120))
  on conflict (code) do nothing;
  update attempts set error_tag = p_tag
  where id = p_attempt and user_id = p_user and not correct and error_tag is null;
  return found;
end $$;

revoke execute on function record_attempt(uuid, uuid, uuid, jsonb, boolean, int) from public, anon, authenticated;
revoke execute on function record_screen(uuid, uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function tag_attempt(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function record_attempt(uuid, uuid, uuid, jsonb, boolean, int),
  record_screen(uuid, uuid, uuid, text, timestamptz),
  tag_attempt(uuid, uuid, text, text, text) to service_role;

create index if not exists attempts_user_item on attempts (user_id, item_id, created_at desc);

-- explain_error: one AI call per wrong answer, 30 a day per student (12 §4 Q52).
update app_config set value = value || '{"explain_error": {"limit": 30}}'::jsonb where key = 'ai_quotas';
