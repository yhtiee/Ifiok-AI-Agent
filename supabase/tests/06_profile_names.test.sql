-- Student names (12 §4 Q30): first and last name, editable by the student; others see "First L.".
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000e1', 'e1@x', '{"first_name":" Chiamaka ","last_name":"Okonkwo"}'),
 ('00000000-0000-0000-0000-0000000000e2', 'e2@x', '{"given_name":"Tunde","family_name":"Bakare","full_name":"Tunde Bakare"}'),
 ('00000000-0000-0000-0000-0000000000e3', 'e3@x', '{"full_name":"Ifiok Effiong Udo"}'),
 ('00000000-0000-0000-0000-0000000000e4', 'e4@x', '{}');

select plan(12);

select is((select (first_name, last_name, display_name) from profiles where id = '00000000-0000-0000-0000-0000000000e1'),
          ('Chiamaka'::text, 'Okonkwo'::text, 'Chiamaka O.'::text), 'sign-up names are trimmed and give "First L."');
select is((select (first_name, last_name) from profiles where id = '00000000-0000-0000-0000-0000000000e2'),
          ('Tunde'::text, 'Bakare'::text), 'Google given and family names are used');
select is((select (first_name, last_name) from profiles where id = '00000000-0000-0000-0000-0000000000e3'),
          ('Ifiok'::text, 'Effiong Udo'::text), 'a full name splits at the first space');
select is((select (first_name, last_name, display_name) from profiles where id = '00000000-0000-0000-0000-0000000000e4'),
          (''::text, ''::text, ''::text), 'no name leaves every name empty (never the email)');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e4';
select lives_ok($$update profiles set first_name = 'Ada', last_name = 'Obi' where id = auth.uid()$$, 'a student can set their own name');
select is((select display_name from profiles where id = auth.uid()), 'Ada O.', 'display name follows the new name');
select lives_ok($$update profiles set last_name = '' where id = auth.uid()$$, 'last name can be cleared');
select is((select display_name from profiles where id = auth.uid()), 'Ada', 'display name is the first name alone without a last name');
select throws_ok($$update profiles set display_name = 'Admin' where id = auth.uid()$$, '42501', null, 'display name is not written directly');
select throws_ok($$update profiles set first_name = repeat('a', 41) where id = auth.uid()$$, '23514', null, 'names are at most 40 characters');
update profiles set first_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000e1';
select is((select display_name from public_profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'Chiamaka O.',
          'other students see the first name and last initial only');
reset role;
select is((select first_name from profiles where id = '00000000-0000-0000-0000-0000000000e1'), 'Chiamaka', 'cannot rename another student');

select * from finish();
rollback;
