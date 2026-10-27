-- MVP-06 fix: Supabase Auth deletes accounts as its own role (supabase_auth_admin), which can't
-- read public.profiles, so the append-only guard's ownership check failed and blocked account
-- deletion. The guard now runs with its owner's rights. Trigger-only: no one can call it directly.
create or replace function earned_units_append_only() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from profiles where id = old.user_id) then
    return old;
  end if;
  raise exception 'earned_units_pending is append-only';
end $$;
revoke execute on function earned_units_append_only() from public, anon, authenticated;
