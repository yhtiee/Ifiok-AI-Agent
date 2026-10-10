-- AI gateway support (P0-10): spend totals for the caps, and the seeded config.
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000c1', 'c1@x'), ('00000000-0000-0000-0000-0000000000c2', 'c2@x');
insert into ai_calls (user_id, feature, provider, model, input_tokens, output_tokens, cost_micros, created_at) values
 ('00000000-0000-0000-0000-0000000000c1', 'tutor_chat', 'gemini', 'm', 10, 10, 500, now()),
 ('00000000-0000-0000-0000-0000000000c1', 'lesson_generate', 'gemini', 'm', 10, 10, 2000, now()),
 ('00000000-0000-0000-0000-0000000000c2', 'tutor_chat', 'gemini', 'm', 10, 10, 300, now()),
 ('00000000-0000-0000-0000-0000000000c2', 'tutor_chat', 'gemini', 'm', 10, 10, 9999, now() - interval '2 days');

select plan(8);
-- now() is the transaction start, so only this test's rows count (real calls in a live project are older).
select is(ai_spend_micros(now()), 2800::bigint, 'spend since a time, all users and skills');
select is(ai_spend_micros(now(), '00000000-0000-0000-0000-0000000000c1'), 2500::bigint, 'spend for one user');
select is(ai_spend_micros(now(), null, array['lesson_generate']), 2000::bigint, 'spend for some skills (library budget)');
select is(ai_spend_micros(now() - interval '7 days', '00000000-0000-0000-0000-0000000000c2'), 10299::bigint, 'older calls count when the window includes them');

select ok((select value ? 'tutor_chat' and value ? '_fallback' from app_config where key = 'ai_routes'), 'routes are seeded, with a fallback');
select is((select value from app_config where key = 'economy_enabled'), 'false'::jsonb, 'the economy starts off (P1)');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000c1';
select throws_ok($$select ai_spend_micros(now())$$, '42501', null, 'clients cannot read spend totals');
select throws_ok($q$select count(*) from ai_calls$q$, '42501', null, 'clients cannot read ai_calls at all');
reset role;

select * from finish();
rollback;
