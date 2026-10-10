-- Owner decision (12 §4 Q25): run the pilot on Gemini's free tier, with students told that Google
-- may keep and review what they send. Calls on a free tier cost nothing, so:
--  - cost_micros is the actual spend (0 on a free tier) and drives the budget caps;
--  - list_cost_micros is what the call would cost at paid list prices, so the pilot still
--    measures the cost per learner (`c`, 00 §7 and 09 §5) for when Ifiok moves to the paid tier.

alter table ai_calls add column list_cost_micros bigint not null default 0;

-- Which billing tier each provider key is on. "free": actual cost recorded as 0 and personal
-- details are stripped from text before it is sent (Gemini terms: no personal information to
-- Unpaid Services). Switch to "paid" when billing is enabled on the Google project.
insert into app_config (key, value) values
  ('ai_billing', '{"gemini": "free", "anthropic": "paid"}'::jsonb)
on conflict (key) do nothing;
