-- MVP-06: explainers hidden until approved, one usage point per (resource, consumer, month),
-- no self-usage, Units earned follow 06 §2 with the 40/month cap, and every write is the
-- server's (12 §4 Q57).
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email, email_confirmed_at) values
 ('00000000-0000-0000-0000-0000000000a6','ca@x', now()),   -- author / contributor
 ('00000000-0000-0000-0000-0000000000b6','cb@x', now()),   -- qualified learner
 ('00000000-0000-0000-0000-0000000000c6','cc@x', null);    -- email not verified
update profiles set is_adult = true where id in
 ('00000000-0000-0000-0000-0000000000a6','00000000-0000-0000-0000-0000000000b6','00000000-0000-0000-0000-0000000000c6');
insert into daily_activity (user_id, day, sessions) values
 ('00000000-0000-0000-0000-0000000000b6', (now() at time zone 'Africa/Lagos')::date, 1),
 ('00000000-0000-0000-0000-0000000000c6', (now() at time zone 'Africa/Lagos')::date, 1),
 ('00000000-0000-0000-0000-0000000000a6', (now() at time zone 'Africa/Lagos')::date, 1);
insert into concepts (id,slug,title,subject,level_band) values
 ('76000000-0000-0000-0000-000000000001','phy.kirchhoff-test','Kirchhoff''s laws','physics','introductory');
insert into explainers (id,author_id,concept_id,kind,title,body_md,status) values
 ('86000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a6','76000000-0000-0000-0000-000000000001','text','Loops made easy','Walk the loop…','approved'),
 ('86000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a6','76000000-0000-0000-0000-000000000001','text','Draft','Not yet…','pending_admin');
insert into sources (id,owner_id,kind,title,visibility,review,shared_at) values
 ('56000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a6','notes','Circuit notes','bank','approved',now());

select plan(19);

-- Usage points
select is(record_usage('explainer','86000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b6'), true,
          'a qualified learner finishing an approved explainer records a point');
select is(record_usage('explainer','86000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b6'), false,
          'finishing it again the same month records nothing');
select is((select count(*)::int from usage_points), 1, 'exactly one usage point');
select is(record_usage('explainer','86000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a6'), false,
          'self-usage records nothing');
select is(record_usage('explainer','86000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000b6'), false,
          'an explainer not yet approved records nothing');
select is(record_usage('explainer','86000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c6'), false,
          'an unqualified consumer (email not verified) records nothing');
select is(record_usage('source','56000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b6'), true,
          'the same learner using the same author''s approved upload records a point for the upload');

-- Units: +1 per (contributor, consumer, month) across resources; +5 per approved upload; cap 40.
select is((select coalesce(sum(units),0)::int from earned_units_pending where user_id = '00000000-0000-0000-0000-0000000000a6'), 1,
          'one consumer earns the contributor 1 Unit this month, however many of their resources they use');
select is(award_pending_units('00000000-0000-0000-0000-0000000000a6', 5, 'upload_approved', 'upload:x'), 5, '+5 for an approved upload');
select is(award_pending_units('00000000-0000-0000-0000-0000000000a6', 5, 'upload_approved', 'upload:x'), 0, 'the same award key adds nothing twice');
select is((select sum(n) from (
  select award_pending_units('00000000-0000-0000-0000-0000000000a6', 5, 'upload_approved', 'upload:' || g) as n
  from generate_series(1, 10) g) s)::int, 34, 'later awards stop at the 40-a-month cap');
select is((select sum(units)::int from earned_units_pending where user_id = '00000000-0000-0000-0000-0000000000a6'), 40,
          'the month''s earned Units never exceed 40');
select throws_ok($$delete from earned_units_pending$$, 'P0001', 'earned_units_pending is append-only', 'earned Units can''t be deleted');

-- What students can read and write
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b6';
select is((select array_agg(title) from explainers), array['Loops made easy'], 'another student sees only approved explainers');
select throws_ok($$select record_usage('explainer','86000000-0000-0000-0000-000000000001',auth.uid())$$, '42501', null,
                 'students can''t record usage themselves');
select throws_ok($$insert into tutor_profiles (user_id, availability) values (auth.uid(), 'Evenings')$$, '42501', null,
                 'tutor profiles are written by the server');
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a6';
select is((select count(*)::int from usage_points), 2, 'a contributor reads their own usage points');

-- Deleting an account still works: its earned Units go with it (08 §6).
reset role;
select lives_ok($$delete from auth.users where id = '00000000-0000-0000-0000-0000000000a6'$$,
                'an account with earned Units can be deleted');
select is((select count(*)::int from earned_units_pending), 0, 'and its earned Units are gone with it');

select * from finish();
rollback;
