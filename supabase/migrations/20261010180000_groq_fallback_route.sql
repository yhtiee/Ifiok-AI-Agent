-- Switch _fallback route to Groq (openai/gpt-oss-120b) and claim_check to Groq (openai/gpt-oss-20b)
-- so multi-provider failover works between Gemini and Groq on free tiers.
update app_config
set value = value || '{
  "_fallback": {"provider": "groq", "model": "openai/gpt-oss-120b"},
  "claim_check": {"provider": "groq", "model": "openai/gpt-oss-20b"}
}'::jsonb,
updated_at = now()
where key = 'ai_routes';

