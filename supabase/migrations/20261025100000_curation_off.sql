-- Owner decision (12 §4 Q51, 25 Oct 2026): no curator gate until the Grow stage. A lesson in a
-- sensitive subject (law, medicine, nursing, pharmacy) that passes every automatic check is
-- published like any other, and order/match checkpoint items are published with their lesson.
-- Lessons that FAIL an automatic check still go to 'review' and are never shown (guardrails 2–3).
-- Turn the gate back on by setting these to true.
insert into app_config (key, value) values
  ('curation', '{"sensitive_lessons_need_curator": false, "order_match_items_need_review": false}')
on conflict (key) do nothing;

-- Order/match checkpoint items waiting only for human review join their published lesson.
update items i set status = 'published'
from lessons l
where i.status = 'review' and i.origin = 'checkpoint' and i.type in ('order', 'match')
  and l.id = i.lesson_id and l.status = 'published';
