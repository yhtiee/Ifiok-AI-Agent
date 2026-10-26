-- MVP-04 exam prep (10 MVP-04, F8, light F6, 12 §4 Q53): reviewed past questions, worked
-- solutions shared within the course, study plans to the exam date, and self-marked answers.

-- Past questions: who added them, sub-part, the shared worked solution (generated once).
alter table exam_questions
  add column added_by uuid references profiles(id) on delete set null,
  add column sub text,
  add column worked_solution jsonb,
  add column worked_solution_at timestamptz;
create index exam_questions_source on exam_questions (source_id);

-- Past-question items (origin 'past_paper', no answer key: self-marked) belong to their course:
-- only members see them, unlike shared practice items, which every student may use.
drop policy items_read on items;
create policy items_read on items for select using (
  (status = 'published' and (
     (owner_id is null and is_adult_active() and (origin <> 'past_paper' or (course_id is not null and is_member(course_id))))
     or owner_id = auth.uid()))
  or is_admin());

-- A student's study plan to the exam date (deterministic planner, lib/agent/planner.ts). Owner only;
-- written by the server, which recomputes it as mastery changes.
create table exam_plans (
  user_id uuid not null references profiles(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  exam_date date not null,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
alter table exam_plans enable row level security;
create policy exam_plans_read_own on exam_plans for select using (user_id = auth.uid());
revoke insert, update, delete on exam_plans from authenticated, anon;

-- Self-marked answers (theory past questions, Q53): "Partly" counts as correct at half weight. The
-- weight factor scales the difficulty weight; everything else is unchanged from learning_evidence.
drop function record_attempt(uuid, uuid, uuid, jsonb, boolean, int);
create or replace function record_attempt(
  p_id uuid,
  p_user uuid,
  p_item uuid,
  p_response jsonb,
  p_correct boolean,
  p_duration_ms int default null,
  p_weight_factor numeric default 1
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
  if p_weight_factor is null or p_weight_factor <= 0 or p_weight_factor > 1 then
    raise exception 'weight factor must be in (0, 1]';
  end if;
  select i.concept_id, (case i.difficulty when 1 then 0.7 when 3 then 1.3 else 1.0 end) * p_weight_factor
    into v_concept, v_weight
  from items i where i.id = p_item;
  if v_concept is null then raise exception 'item % not found', p_item; end if;

  insert into attempts (id, user_id, item_id, response, correct, duration_ms)
  values (p_id, p_user, p_item, p_response, p_correct, p_duration_ms)
  on conflict (id) do nothing;

  if not found then
    return query
      select false, v_concept, coalesce(ms.m, 0)::numeric, coalesce(ms.level, 'not_started')
      from (select 1) one left join mastery ms on ms.user_id = p_user and ms.concept_id = v_concept;
    return;
  end if;

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
revoke execute on function record_attempt(uuid, uuid, uuid, jsonb, boolean, int, numeric) from public, anon, authenticated;
grant execute on function record_attempt(uuid, uuid, uuid, jsonb, boolean, int, numeric) to service_role;

-- Worked solutions: one AI call per question ever (shared in the course), 20 new ones a day per student.
update app_config set value = value || '{"worked_solution": {"limit": 20}}'::jsonb where key = 'ai_quotas';
update app_config set value = value || '{"worked_solution": {"provider": "groq", "model": "openai/gpt-oss-120b", "thinking": "low"}}'::jsonb
  where key = 'ai_routes';
