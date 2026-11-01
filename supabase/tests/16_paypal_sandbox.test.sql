-- MVP-07 (06 §3, §12, §15): the pool split never exceeds the pool and no line exceeds 20%; a
-- payout webhook replayed 3 times marks the line paid once; bookings follow their state machine;
-- money rows are readable only by their people and never client-writable.
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a8','pa@x'),('00000000-0000-0000-0000-0000000000b8','pb@x'),
 ('00000000-0000-0000-0000-0000000000c8','pc@x'),('00000000-0000-0000-0000-0000000000d8','pd@x');
update profiles set is_adult = true where id::text like '00000000-0000-0000-0000-0000000000_8';
insert into concepts (id,slug,title,subject,level_band) values
 ('78000000-0000-0000-0000-000000000001','phy.kvl-pay-test','KVL','physics','introductory');

-- 10 points this month: A has 8 (would be 80%), B 1, C 1. D consumes.
insert into usage_points (resource_kind, resource_id, contributor_id, consumer_id, month)
select 'source', gen_random_uuid(), '00000000-0000-0000-0000-0000000000a8', '00000000-0000-0000-0000-0000000000d8', '2026-10-01'
from generate_series(1, 8);
insert into usage_points (resource_kind, resource_id, contributor_id, consumer_id, month) values
 ('source', gen_random_uuid(), '00000000-0000-0000-0000-0000000000b8', '00000000-0000-0000-0000-0000000000d8', '2026-10-01'),
 ('source', gen_random_uuid(), '00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-0000000000d8', '2026-10-01');
insert into payout_accounts (user_id, paypal_email) values
 ('00000000-0000-0000-0000-0000000000a8', 'contributor-a@personal.example.com');

select plan(25);

select lives_ok($$ select compute_period('2026-10-01', 10000) $$, 'a month''s pool is split');
select is((select amount_cents from payout_lines where user_id = '00000000-0000-0000-0000-0000000000a8'), 2000::bigint,
          'a contributor with 80% of the points gets the 20% cap');
select is((select capped from payout_lines where user_id = '00000000-0000-0000-0000-0000000000a8'), true, 'and the line says capped');
select is((select amount_cents from payout_lines where user_id = '00000000-0000-0000-0000-0000000000b8'), 1000::bigint,
          'others get pool × points / total');
select ok((select bool_and(amount_cents <= 0.2 * 10000) from payout_lines), 'no line exceeds 20% of the pool');
select ok((select sum(amount_cents) <= 10000 from payout_lines), 'lines never exceed the pool');
select is((select carried_cents from payout_periods where month = '2026-10-01'), 6000::bigint,
          'what the cap holds back stays in the pool');
select is(compute_period('2026-10-01', 99999), (select id from payout_periods where month = '2026-10-01'),
          'computing the month again returns the same period');

select is((select count(*)::int from prepare_payout((select id from payout_periods where month = '2026-10-01'))), 1,
          'only contributors with a PayPal email are paid');
select is((select count(*)::int from payout_lines where status = 'no_account'), 2, 'the others wait for an email');
select is(mark_period_sent((select id from payout_periods where month = '2026-10-01'), 'BATCH-1'), 1, 'the batch is sent');
select is(mark_period_sent((select id from payout_periods where month = '2026-10-01'), 'BATCH-1'), 0, 'a replay sends nothing');

-- The webhook for the item, replayed 3 times: the line is marked paid once.
select is(paypal_event_once('WH-1', 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED'), true, 'a new webhook event');
select is((select count(*)::int from (select paypal_event_once('WH-1', 'PAYMENT.PAYOUTS-ITEM.SUCCEEDED') from generate_series(1, 3)) r
           where paypal_event_once is true), 0, 'the same event replayed 3 times is recognised');
select is((select array_agg(changed) from (select record_payout_item(
            (select id from payout_lines where user_id = '00000000-0000-0000-0000-0000000000a8'), 'ITEM-1', 'SUCCESS') as changed
          from generate_series(1, 3)) r), array[true, false, false], 'the line is marked paid exactly once');

-- A failed item can be sent again in a new batch (new attempt, new sender batch id).
select record_payout_item((select id from payout_lines where user_id = '00000000-0000-0000-0000-0000000000a8'), 'ITEM-1', 'RETURNED');
select is(reopen_failed_payouts((select id from payout_periods where month = '2026-10-01')), 1, 'a returned line goes back to pending');
select is((select status || ':' || attempt from payout_periods where month = '2026-10-01'), 'computed:2',
          'and the month can be sent again as attempt 2');

-- Bookings: authorise → capture → paid out; void only before capture; replays change nothing.
insert into tutoring_bookings (id, learner_id, tutor_id, concept_id, starts_at, minutes, price_cents, take_rate_bp) values
 ('98000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-0000000000a8',
  '78000000-0000-0000-0000-000000000001', now() + interval '1 day', 45, 1000, 1500),
 ('98000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000d8','00000000-0000-0000-0000-0000000000a8',
  '78000000-0000-0000-0000-000000000001', now() + interval '1 day', 45, 1000, 1500);
select is(array[booking_step('98000000-0000-0000-0000-000000000001','authorized','AUTH-1'),
                booking_step('98000000-0000-0000-0000-000000000001','authorized','AUTH-1')], array[true, false],
          'authorising twice changes the booking once');
select is(array[booking_step('98000000-0000-0000-0000-000000000001','captured','CAP-1','learner'),
                booking_step('98000000-0000-0000-0000-000000000001','voided')], array[true, false],
          'a captured booking can''t be voided');
select is(booking_step('98000000-0000-0000-0000-000000000002','captured','CAP-2'), false, 'nothing is captured before it''s authorised');
select is(array[booking_step('98000000-0000-0000-0000-000000000002','authorized','AUTH-2'),
                booking_step('98000000-0000-0000-0000-000000000002','voided', null, 'Tutor didn''t show')], array[true, true],
          'a tutor no-show voids the authorisation');

-- The agent never proposes above the student's own limit.
select throws_ok($$ insert into agent_proposals (user_id, concept_id, tutor_id, starts_at, price_cents, spend_limit_cents, reason, decided_by)
  values ('00000000-0000-0000-0000-0000000000d8', '78000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a8',
          now() + interval '1 day', 2000, 1500, 'x', 'ai') $$, '23514', null, 'a proposal above the spending limit is refused');

-- The learner sees their bookings; a stranger sees none; nobody writes them from the client.
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b8';
select is((select count(*)::int from tutoring_bookings) + (select count(*)::int from payout_lines where user_id <> '00000000-0000-0000-0000-0000000000b8'), 0,
          'a stranger sees no one else''s bookings or payout lines');
select throws_ok($$ update payout_lines set status = 'paid' $$, '42501', null, 'payout lines aren''t client-writable');
select throws_ok($$ insert into tutoring_preferences (user_id, spend_limit_cents) values ('00000000-0000-0000-0000-0000000000b8', 99999) $$,
                 '42501', null, 'the spending limit is set through the server, not the client');

select * from finish();
rollback;
