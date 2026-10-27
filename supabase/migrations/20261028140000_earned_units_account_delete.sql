-- MVP-06 fix: earned_units_pending is append-only, but its rows must still go when their account is
-- deleted (08 §6, the right to deletion). The guard now allows a delete only once the owning
-- profile is gone (the ON DELETE CASCADE from profiles); every other update or delete is refused.
create or replace function earned_units_append_only() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from profiles where id = old.user_id) then
    return old;
  end if;
  raise exception 'earned_units_pending is append-only';
end $$;
