-- Owner decision 31 Oct 2026 (12 §4 Q60): materials upload as files. A student's PDF, Word document
-- or photo is stored as it is, privately, in the `materials` bucket and read on the server side of
-- Ifiok (text layers in the browser, photos and scanned pages by OCR). Textbook pages are stored
-- too and may be shared to the Library like any other material. Retires guardrail 11 and F3's
-- "only the text of picked pages leaves the phone". Lessons from materials are built only when a
-- student asks for a topic (no automatic building on upload).

-- Textbook pages: no longer text-only and no longer private-only.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.sources'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%textbook_private%'
  loop
    execute format('alter table sources drop constraint %I', c.conname);
  end loop;
end $$;

-- What the stored file is, so the viewer knows how to show it.
alter table sources add column file_mime text
  check (file_mime is null or file_mime in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/heic', 'image/webp'));

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('materials', 'materials', false, 20 * 1024 * 1024,
            array['application/pdf',
                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  'image/jpeg', 'image/png', 'image/heic', 'image/webp'])
    on conflict (id) do nothing;
  end if;
end $$;

-- OCR for photos and scanned pages: a per-student daily allowance of pages, and Gemini (images).
update app_config set value = value || '{"ocr_pages": {"limit": 60}}'::jsonb where key = 'ai_quotas';
update app_config set value = value || '{"ocr_pages": {"provider": "gemini", "model": "gemini-3.5-flash", "thinking": "low"}}'::jsonb
  where key = 'ai_routes';
