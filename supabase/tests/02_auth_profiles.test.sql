-- Accounts, the 18+ gate and consents (F0, 08 §2.1, §3; P0-04).
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1', 'ada@x', '{"full_name":"Ada Obi"}'),
 ('00000000-0000-0000-0000-0000000000a2', 'teen@x', '{}');

select plan(19);

-- A profile is created for every auth user, starting not adult and not onboarded.
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000a1'), 'Ada Obi', 'new user gets a profile with the provider display name');
select is((select display_name from profiles where id = '00000000-0000-0000-0000-0000000000a2'), '', 'no name from the provider leaves the display name empty (never the email)');
select is((select (is_adult, role::text, status::text, onboarded_at) from profiles where id = '00000000-0000-0000-0000-0000000000a1'),
          (false, 'student'::text, 'active'::text, null::timestamptz), 'new profiles start as a non-adult, active student, not onboarded');

-- The signed-in user, before the date-of-birth step
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from profiles), 1, 'a user reads only their own profile');
select is(is_adult_active(), false, 'not adult until the server records the date of birth');
select throws_ok($$update profiles set is_adult = true where id = auth.uid()$$, '42501', null, 'cannot mark self adult');
select throws_ok($$update profiles set birth_year = 1990, birth_month = 1 where id = auth.uid()$$, '42501', null, 'cannot write own birth date');
select throws_ok($$update profiles set onboarded_at = now() where id = auth.uid()$$, '42501', null, 'cannot mark self onboarded');
select throws_ok($$update profiles set status = 'active' where id = auth.uid()$$, '42501', null, 'cannot change own status');
select throws_ok($$insert into consents (user_id, kind, version) values (auth.uid(), 'terms', 'v1')$$, '42501', null, 'consents are recorded by the server only');
select lives_ok($$update profiles set level = 200, daily_minutes = 45, university_id = null where id = auth.uid()$$, 'can save level, daily minutes and university');
select throws_ok($$update profiles set daily_minutes = 20 where id = auth.uid()$$, '23514', null, 'daily minutes must be 15, 30, 45 or 60');
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'cannot read another user''s profile');
reset role;

-- Server: adult path records the date of birth and consents
update profiles set birth_year = 1999, birth_month = 4, is_adult = true where id = '00000000-0000-0000-0000-0000000000a1';
insert into consents (user_id, kind, version) values ('00000000-0000-0000-0000-0000000000a1', 'terms', 'v1'), ('00000000-0000-0000-0000-0000000000a1', 'privacy', 'v1'), ('00000000-0000-0000-0000-0000000000a1', 'ai_disclosure', 'v1');
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
select is(is_adult_active(), true, 'adult after the server records the date of birth');
select is((select count(*)::int from consents), 3, 'the user can read their own consents');
reset role;

-- Server: under-18 path deletes the auth user; nothing is left behind.
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a2';
select is((select count(*)::int from profiles where id = '00000000-0000-0000-0000-0000000000a2'), 0, 'deleting an under-18 auth user removes the profile');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select is((select count(*)::int from consents where user_id = '00000000-0000-0000-0000-0000000000a1'), 0, 'deleting a user removes their consents');

-- Anonymous visitors
set local role anon;
select throws_ok($$select count(*) from profiles$$, '42501', null, 'anon cannot query profiles');
select throws_ok($$select count(*) from public_profiles$$, '42501', null, 'anon cannot read public_profiles');
reset role;

select * from finish();
rollback;
