-- Owner decision (12 §4 Q27): no output token caps on any skill while the pilot runs on the free
-- Gemini tier (tokens cost nothing there; caps only risk cut-off replies). Each model's own maximum
-- applies. To cap a skill again, add "max_output_tokens" back to its route.
update app_config
set value = (
      select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' then v - 'max_output_tokens' else v end)
      from jsonb_each(value) as e(k, v)
    ),
    updated_at = now()
where key = 'ai_routes';
