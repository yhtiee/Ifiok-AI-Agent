-- MVP-06 Library documents (owner decision 28 Oct 2026, 12 §4 Q59): shared notes, lab manuals,
-- worked solutions and past questions are standalone Library items, read in a document viewer.
-- A PDF uploaded to the Library keeps the picked pages as a real PDF (built on the phone from just
-- those pages; the rest never leave it) in a private bucket, served through short-lived signed URLs
-- and Ifiok's own pdf.js viewer (08 §2.5). Course materials stay text-only (F3).

alter table sources
  add column thumb_path text,
  add column file_bytes int check (file_bytes is null or file_bytes <= 20 * 1024 * 1024);

do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('library', 'library', false, 20 * 1024 * 1024, array['application/pdf', 'image/jpeg'])
    on conflict (id) do nothing;
  end if;
end $$;

-- Reports on a Library document (08 §7): one per student; 3 from distinct students send it back to
-- an admin (review 'needs_review'), which takes it out of the Library until it's looked at.
create unique index reports_once_per_target on reports (reporter_id, target_kind, target_id);

create or replace function report_source(p_source uuid, p_reporter uuid, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_count int;
begin
  select owner_id into v_owner from sources where id = p_source and visibility = 'bank' and review = 'approved';
  if v_owner is null or v_owner = p_reporter then return 0; end if;
  insert into reports (reporter_id, target_kind, target_id, reason)
  values (p_reporter, 'source', p_source::text, left(p_reason, 300))
  on conflict do nothing;
  select count(*) into v_count from reports where target_kind = 'source' and target_id = p_source::text and status = 'open';
  if v_count >= coalesce((select (value ->> 'hide_after_reports')::int from app_config where key = 'moderation'), 3) then
    update sources set review = 'needs_review', review_reason = 'Hidden after reports from students.'
    where id = p_source and review = 'approved';
  end if;
  return v_count;
end $$;
revoke execute on function report_source(uuid, uuid, text) from public, anon, authenticated;
grant execute on function report_source(uuid, uuid, text) to service_role;
