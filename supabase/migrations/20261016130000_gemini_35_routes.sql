-- Owner decision (16 Oct 2026, 12 §4 Q34): gemini-3.1-flash-lite and gemini-3.8-flash return
-- 503 "high demand" on the free tier, so every call fell through to Groq. Route those skills to
-- gemini-3.5-flash-lite and gemini-3.5-flash (both answering, same thinking levels accepted).
-- Thinking levels and token settings are unchanged. Reverting is the same update the other way.

update app_config
set value = (
  select jsonb_object_agg(
    key,
    case
      when val ->> 'provider' = 'gemini' and val ->> 'model' = 'gemini-3.1-flash-lite'
        then jsonb_set(val, '{model}', '"gemini-3.5-flash-lite"')
      when val ->> 'provider' = 'gemini' and val ->> 'model' = 'gemini-3.8-flash'
        then jsonb_set(val, '{model}', '"gemini-3.5-flash"')
      else val
    end)
  from jsonb_each(value) as r(key, val)
),
updated_at = now()
where key = 'ai_routes';

-- The gateway skips any model without a price (04 §3). These are PLACEHOLDERS copied from the
-- reference prices of the models they replace, not Google's published 3.5 prices: confirm them
-- before billing moves to paid (Q24, Q25). On the free tier they only feed list_cost_micros.
update app_config
set value = value || '[
  {"provider":"gemini","model":"gemini-3.5-flash-lite","effective_from":"2026-01-01","input":0.25,"output":1.50},
  {"provider":"gemini","model":"gemini-3.5-flash","effective_from":"2026-01-01","input":0.75,"output":3.75},
  {"provider":"gemini","model":"gemini-3.5-flash","effective_from":"2027-01-01","input":1.50,"output":7.50}
]'::jsonb,
updated_at = now()
where key = 'ai_prices'
  and not exists (
    select 1 from jsonb_array_elements(value) p where p ->> 'model' in ('gemini-3.5-flash-lite', 'gemini-3.5-flash')
  );
