-- P0-10 AI gateway: spend totals for the budget caps, and the default runtime config
-- (specifications/04-ai.md §3, §5; 09-cost-plan.md §6). Config values are data: admins change
-- them in app_config (validated with zod in lib/config.ts); this only seeds what doesn't exist.

-- Sum of ai_calls.cost_micros since a time, optionally for one user and/or some skills.
-- Used by the gateway for the global daily cap, the library budget and the per-user ceiling.
create or replace function ai_spend_micros(p_since timestamptz, p_user uuid default null, p_features text[] default null)
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(cost_micros), 0)::bigint
  from ai_calls
  where created_at >= p_since
    and (p_user is null or user_id = p_user)
    and (p_features is null or feature = any(p_features));
$$;
revoke execute on function ai_spend_micros(timestamptz, uuid, text[]) from public, anon, authenticated;
grant execute on function ai_spend_micros(timestamptz, uuid, text[]) to service_role;

-- Model routes per skill. Lowest thinking level each model accepts for classification and the
-- tutor; "low" for generation (04 §3). Model IDs live here, never in code.
insert into app_config (key, value) values
('ai_routes', '{
  "tutor_chat":          {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":700},
  "tutor_explain_style": {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":700},
  "lesson_generate":     {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":6000},
  "lesson_repair":       {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":6000},
  "items_generate":      {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":4000},
  "scheme_extract":      {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":3000},
  "exam_extract":        {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":4000},
  "ocr_pages":           {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":6000},
  "transcribe_working":  {"provider":"gemini","model":"gemini-3.8-flash","thinking":"low","max_output_tokens":2000},
  "explain_error":       {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":200},
  "exam_classify":       {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":1000},
  "curate_classify":     {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":1000},
  "answer_check":        {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":500},
  "item_solve":          {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":800},
  "claim_check":         {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":2000},
  "teach_back_check":    {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":500},
  "brief_rewrite":       {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":120},
  "page_match_rerank":   {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":500},
  "topic_resolve":       {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":800},
  "outline_draft":       {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":1500},
  "moderate":            {"provider":"gemini","model":"gemini-3.1-flash-lite","thinking":"minimal","max_output_tokens":200},
  "_fallback":           {"provider":"anthropic","model":"claude-haiku-4-5"}
}'::jsonb),

-- USD per 1M tokens; thinking is billed as output. The latest effective_from on or before the call
-- date applies, so the January 2027 Flash price change needs no deploy (04 §3; confirm before launch).
('ai_prices', '[
  {"provider":"gemini","model":"gemini-3.1-flash-lite","effective_from":"2026-01-01","input":0.25,"output":1.50},
  {"provider":"gemini","model":"gemini-3.8-flash","effective_from":"2026-01-01","input":0.75,"output":3.75},
  {"provider":"gemini","model":"gemini-3.8-flash","effective_from":"2027-01-01","input":1.50,"output":7.50},
  {"provider":"anthropic","model":"claude-haiku-4-5","effective_from":"2026-01-01","input":1.00,"output":5.00}
]'::jsonb),

-- Free allowances in the P1 pilot (04 §5, 06 §2).
('ai_quotas', '{
  "tutor":     {"limit": 8},
  "snap_mark": {"limit": 2}
}'::jsonb),

-- Budget guards (09 §6, P1 column). Library budget: $20/day for the first 2 weeks, then lower it to 5.
('ai_caps', '{
  "global_daily_usd": 3,
  "library_daily_usd": 20,
  "per_user_monthly_usd": 0.30,
  "alert_ratio": 0.8
}'::jsonb),

('kill_switches', '{"skills": [], "models": []}'::jsonb),
('economy_enabled', 'false'::jsonb)
on conflict (key) do nothing;
