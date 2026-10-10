-- Student names (12 §4 Q30): first and last name on the profile, editable by the student.
-- display_name, the only name other students see (public_profiles: outline history, credits),
-- is derived as "First L." so a full surname is never shown to others.

alter table profiles
  add column first_name text not null default ''
    check (char_length(first_name) <= 40 and first_name = btrim(first_name)),
  add column last_name text not null default ''
    check (char_length(last_name) <= 40 and last_name = btrim(last_name));

create or replace function profile_display_name(p_first text, p_last text) returns text
language sql immutable set search_path = public as $$
  select btrim(coalesce(p_first, '') || case when coalesce(p_last, '') <> '' then ' ' || upper(left(p_last, 1)) || '.' else '' end);
$$;

create or replace function sync_display_name() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.first_name is distinct from old.first_name or new.last_name is distinct from old.last_name then
    new.display_name := left(profile_display_name(new.first_name, new.last_name), 60);
  end if;
  return new;
end $$;

create trigger profiles_display_name before insert or update on profiles
  for each row execute function sync_display_name();

-- Names come from sign-up (first_name/last_name metadata) or a provider (Google's given_name/
-- family_name, or a full name split at the first space). Never the email (08 §4).
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  full_name text := btrim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  v_first text := btrim(coalesce(meta ->> 'first_name', meta ->> 'given_name', ''));
  v_last text := btrim(coalesce(meta ->> 'last_name', meta ->> 'family_name', ''));
begin
  if v_first = '' and full_name <> '' then
    v_first := split_part(full_name, ' ', 1);
    v_last := btrim(substr(full_name, char_length(v_first) + 1));
  end if;
  insert into profiles (id, first_name, last_name)
  values (new.id, btrim(left(v_first, 40)), btrim(left(v_last, 40)))
  on conflict (id) do nothing;
  return new;
end $$;

-- Existing accounts: split the name they already have.
update profiles
set first_name = btrim(left(split_part(btrim(display_name), ' ', 1), 40)),
    last_name = btrim(left(btrim(substr(btrim(display_name), char_length(split_part(btrim(display_name), ' ', 1)) + 1)), 40))
where display_name <> '' and first_name = '';

-- Students edit their names; display_name follows and is no longer written directly.
revoke update (display_name) on profiles from authenticated;
grant update (first_name, last_name) on profiles to authenticated;

revoke execute on function sync_display_name() from public, anon, authenticated;
revoke execute on function handle_new_user() from public, anon, authenticated;
