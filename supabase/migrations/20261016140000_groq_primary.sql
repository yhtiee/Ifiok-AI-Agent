-- Owner decision (16 Oct 2026, 12 §4 Q35): Groq is the primary provider for text skills and Gemini
-- the fallback. Groq's gpt-oss models are text-only, so the image skills stay on Gemini. Groq limits
-- each model separately (free tier: 8,000 tokens/min and 1,000 requests/day per model), so long
-- generation uses gpt-oss-120b and the small frequent skills use gpt-oss-20b.

update app_config
set value = (
  select jsonb_object_agg(
    key,
    case
      -- Long structured generation: gpt-oss-120b.
      when key in ('lesson_generate', 'lesson_repair', 'items_generate')
        then jsonb_build_object('provider', 'groq', 'model', 'openai/gpt-oss-120b', 'thinking', 'low')
      -- Images or PDFs in the request: Gemini only.
      when key in ('scheme_extract', 'transcribe_working', 'ocr_pages', 'exam_extract')
        then val
      -- The fallback for everything: Gemini.
      when key = '_fallback'
        then jsonb_build_object('provider', 'gemini', 'model', 'gemini-3.5-flash', 'thinking', 'low')
      -- Every other text skill: gpt-oss-20b.
      else jsonb_build_object('provider', 'groq', 'model', 'openai/gpt-oss-20b', 'thinking', 'low')
    end)
  from jsonb_each(value) as r(key, val)
),
updated_at = now()
where key = 'ai_routes';
