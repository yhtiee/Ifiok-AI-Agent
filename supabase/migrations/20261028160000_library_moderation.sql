-- MVP-06 library and moderation (owner decisions 28 Oct 2026, 12 §4 Q58). Replaces Q42's "an admin
-- approves every explainer" with layered moderation, as large platforms do: automatic checks first,
-- publish when they pass for authors with a track record, a person for new authors' first 3 and for
-- anything flagged, reports that hide an explainer after 3, and spot checks of auto-published ones.

-- The admin section: the admin role with email and password (no TOTP) until L-02, by owner decision.
-- is_admin() keeps requiring TOTP (aal2) for everything else (RLS policies, lesson curation).
create or replace function is_review_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin' and status = 'active');
$$;
revoke execute on function is_review_admin() from public, anon;
grant execute on function is_review_admin() to authenticated, service_role;

-- 'hidden': taken down by reports or an admin, pending review. Auto-published ones get spot-checked.
alter table explainers drop constraint explainers_status_check;
alter table explainers add constraint explainers_status_check
  check (status in ('uploading', 'processing', 'pending_admin', 'held', 'approved', 'rejected', 'withdrawn', 'hidden'));
alter table explainers
  add column auto_published boolean not null default false,
  add column spot_checked_at timestamptz;

-- Reports (08 §7b): one per student per explainer; 3 from distinct students hide it for review.
create table explainer_reports (
  explainer_id uuid not null references explainers(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 300),
  created_at timestamptz not null default now(),
  primary key (explainer_id, reporter_id)
);
alter table explainer_reports enable row level security;
create policy explainer_reports_read_own on explainer_reports for select to authenticated using (reporter_id = auth.uid());
revoke insert, update, delete on explainer_reports from anon, authenticated;

-- Server only: records a report and hides the explainer at the threshold. The author can't report
-- their own. Returns the number of distinct reports.
create or replace function report_explainer(p_explainer uuid, p_reporter uuid, p_reason text)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_author uuid;
  v_count int;
begin
  select author_id into v_author from explainers where id = p_explainer and status = 'approved';
  if v_author is null or v_author = p_reporter then return 0; end if;
  insert into explainer_reports (explainer_id, reporter_id, reason) values (p_explainer, p_reporter, p_reason)
  on conflict do nothing;
  select count(*) into v_count from explainer_reports where explainer_id = p_explainer;
  if v_count >= coalesce((select (value ->> 'hide_after_reports')::int from app_config where key = 'moderation'), 3) then
    update explainers set status = 'hidden', review_reason = 'Hidden after reports from students.', updated_at = now()
    where id = p_explainer and status = 'approved';
  end if;
  return v_count;
end $$;
revoke execute on function report_explainer(uuid, uuid, text) from public, anon, authenticated;
grant execute on function report_explainer(uuid, uuid, text) to service_role;

insert into app_config (key, value) values
  ('moderation', '{"trusted_after_approved": 3, "hide_after_reports": 3, "spot_checks": 5}'::jsonb)
on conflict (key) do nothing;
