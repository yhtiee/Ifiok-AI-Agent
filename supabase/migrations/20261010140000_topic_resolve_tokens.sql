-- topic_resolve replies for long outlines were cut off at 800 output tokens (a new concept takes
-- about 120 tokens, so a batch of 8 needs ~1,000–1,500). Raise the cap; the gateway also retries
-- once with a larger budget when a reply is truncated.
update app_config
set value = jsonb_set(value, '{topic_resolve,max_output_tokens}', '3000'::jsonb), updated_at = now()
where key = 'ai_routes' and (value #>> '{topic_resolve,max_output_tokens}')::int < 3000;
