-- Add Groq pricing and models to ai_prices, set groq billing to free, and add generous new_lesson quota
update app_config
set value = (
  select jsonb_agg(elem)
  from (
    select jsonb_array_elements(value) as elem
    from app_config
    where key = 'ai_prices'
    union
    select elem
    from jsonb_array_elements('[
      {"provider":"groq","model":"openai/gpt-oss-120b","effective_from":"2026-01-01","input":0.15,"output":0.60},
      {"provider":"groq","model":"openai/gpt-oss-20b","effective_from":"2026-01-01","input":0.05,"output":0.10},
      {"provider":"groq","model":"llama-3.3-70b-versatile","effective_from":"2026-01-01","input":0.59,"output":0.79},
      {"provider":"groq","model":"llama-3.1-8b-instant","effective_from":"2026-01-01","input":0.05,"output":0.08}
    ]'::jsonb) as elem
  ) u
),
updated_at = now()
where key = 'ai_prices';

update app_config
set value = value || '{"groq": "free"}'::jsonb,
    updated_at = now()
where key = 'ai_billing';

update app_config
set value = value || '{"new_lesson": {"limit": 100}}'::jsonb,
    updated_at = now()
where key = 'ai_quotas';

