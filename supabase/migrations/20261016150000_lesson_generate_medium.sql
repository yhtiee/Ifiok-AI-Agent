-- Owner decision (16 Oct 2026, 12 §4 Q36): lesson_generate reasons at "medium" on gpt-oss-120b.
-- Measured with prompt v5: 30–90% more explanation than "low", same pass rate. It uses more of
-- Groq's 8,000 tokens/min per lesson, so expect about one new lesson per minute on Groq before
-- calls fall back to Gemini.
update app_config
set value = jsonb_set(value, '{lesson_generate,thinking}', '"medium"'),
    updated_at = now()
where key = 'ai_routes' and value ? 'lesson_generate';
