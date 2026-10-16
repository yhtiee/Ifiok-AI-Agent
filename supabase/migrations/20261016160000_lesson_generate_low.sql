-- Reverts 20261016150000 (12 §4 Q36): with prompt v6, "medium" reasoning on gpt-oss-120b used
-- ~4,700 of the ~5,000 completion tokens Groq's free tier leaves per request, so lessons were cut
-- off and every lesson fell back to Gemini. "Low" fits and keeps Groq as the primary.
update app_config
set value = jsonb_set(value, '{lesson_generate,thinking}', '"low"'),
    updated_at = now()
where key = 'ai_routes' and value ? 'lesson_generate';
