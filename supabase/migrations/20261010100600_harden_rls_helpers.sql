-- Signed-out visitors never need the RLS helpers (Supabase advisor 0028). Revoking anon's EXECUTE
-- means an anonymous query on a protected table fails with "permission denied" instead of
-- quietly evaluating the helpers. Signed-in users keep EXECUTE: policies call these functions.
revoke execute on function is_admin() from public, anon;
revoke execute on function is_adult_active() from public, anon;
revoke execute on function is_member(uuid) from public, anon;
revoke execute on function is_curator(uuid) from public, anon;
revoke execute on function is_course_lecturer(uuid) from public, anon;
grant execute on function is_admin(), is_adult_active(), is_member(uuid), is_curator(uuid), is_course_lecturer(uuid)
  to authenticated, service_role;
