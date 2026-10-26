-- MVP-04 (12 §4 Q53): exam_extract reads only the text of the picked pages (scanned pages can't be
-- read yet), so it is a text skill under Q35: Groq first (gpt-oss-120b, for the long question list),
-- Gemini as the fallback. Back-to-back papers on the Gemini free tier hit its per-minute limit and
-- failed every attempt with no fallback left. Move it back to Gemini when page images are sent.

update app_config
set value = jsonb_set(
      value,
      '{exam_extract}',
      jsonb_build_object('provider', 'groq', 'model', 'openai/gpt-oss-120b', 'thinking', 'low')
    ),
    updated_at = now()
where key = 'ai_routes';
