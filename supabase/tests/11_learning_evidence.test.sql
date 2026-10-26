-- MVP-03 learning evidence: replays record once, mastery follows F5-FR4 at its boundaries, only the
-- server writes evidence, and students read only their own (guardrail 6, 11 §2).
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a3','la@x'),('00000000-0000-0000-0000-0000000000b3','lb@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000b3');
insert into concepts (id,slug,title,subject,level_band) values
 ('73000000-0000-0000-0000-000000000001','mechanics.ev-test','Projectiles','physics','introductory');
insert into items (id,concept_id,type,difficulty,stem,answer,verification,origin,status) values
 ('63000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','mcq',2,'{}','{}','{}','generated','published'),
 ('63000000-0000-0000-0000-000000000002','73000000-0000-0000-0000-000000000001','numeric',1,'{}','{}','{}','generated','published'),
 ('63000000-0000-0000-0000-000000000003','73000000-0000-0000-0000-000000000001','numeric',3,'{}','{}','{}','generated','published');
insert into lessons (id,concept_id,status,dsl_version,spec) values
 ('43000000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','published',1,'{}');

-- A shorthand: student A answers item 1 (difficulty 2, weight 1.0).
create function pg_temp.answer(p_id text, p_correct boolean, p_item text default '63000000-0000-0000-0000-000000000001')
returns table (inserted boolean, m numeric, level text) language sql as $$
  select r.inserted, r.m, r.level from record_attempt(p_id::uuid, '00000000-0000-0000-0000-0000000000a3', p_item::uuid, '{}', p_correct) r
$$;

select plan(20);

select is((select row(inserted, m, level)::text from pg_temp.answer('a3000000-0000-0000-0000-000000000001', true)),
          '(t,0.180,not_started)', 'first correct answer: m = 0.18 (below Familiar)');
select is((select row(inserted, m, level)::text from pg_temp.answer('a3000000-0000-0000-0000-000000000001', true)),
          '(f,0.180,not_started)', 'a replayed attempt UUID changes nothing');
select is((select count(*)::int from attempts where user_id = '00000000-0000-0000-0000-0000000000a3'), 1, 'and records one row');
select is((select row(m, level)::text from pg_temp.answer('a3000000-0000-0000-0000-000000000002', true)),
          '(0.328,familiar)', 'second correct: m ← m + (1−m)·0.18 crosses Familiar (0.30)');
select is((select m from pg_temp.answer('a3000000-0000-0000-0000-000000000003', false)), 0.256::numeric,
          'wrong: m ← m − m·0.22');
select is((select m from pg_temp.answer('a3000000-0000-0000-0000-000000000004', true, '63000000-0000-0000-0000-000000000002')),
          0.350::numeric, 'easy items weigh 0.7: m + (1−m)·0.18·0.7');
select is((select m from pg_temp.answer('a3000000-0000-0000-0000-000000000005', false, '63000000-0000-0000-0000-000000000003')),
          0.250::numeric, 'hard items weigh 1.3: m − m·0.22·1.3');

-- Proficient at 0.60 sets proficient_at; falling back clears it.
update mastery set m = 0.59, level = 'familiar' where user_id = '00000000-0000-0000-0000-0000000000a3';
select is((select level from pg_temp.answer('a3000000-0000-0000-0000-000000000006', true)), 'proficient', 'crossing 0.60 is Proficient');
select isnt((select proficient_at from mastery where user_id = '00000000-0000-0000-0000-0000000000a3'), null, 'and records when');
select is((select level from pg_temp.answer('a3000000-0000-0000-0000-000000000007', false, '63000000-0000-0000-0000-000000000003')),
          'familiar', 'falling below 0.60 drops to Familiar');
select is((select proficient_at from mastery where user_id = '00000000-0000-0000-0000-0000000000a3'), null, 'and clears proficient_at');

-- Mastered: m ≥ 0.85 and a correct answer ≥ 3 days after reaching Proficient.
update mastery set m = 0.84, level = 'proficient', proficient_at = now() where user_id = '00000000-0000-0000-0000-0000000000a3';
select is((select row(m, level)::text from pg_temp.answer('a3000000-0000-0000-0000-000000000008', true)),
          '(0.869,proficient)', 'm ≥ 0.85 the same day stays Proficient (no spaced check yet)');
update mastery set proficient_at = now() - interval '4 days' where user_id = '00000000-0000-0000-0000-0000000000a3';
select is((select level from pg_temp.answer('a3000000-0000-0000-0000-000000000009', true)), 'mastered',
          'a correct answer 3+ days after Proficient, at m ≥ 0.85, is Mastered');

-- Screens and activity
select is(record_screen('b3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3','43000000-0000-0000-0000-000000000001','s1',now()),
          true, 'a finished screen is recorded');
select is(record_screen('b3000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a3','43000000-0000-0000-0000-000000000001','s1',now()),
          false, 'a replayed screen UUID is not');
select is((select events from daily_activity where user_id = '00000000-0000-0000-0000-0000000000a3'), 1, 'activity counts it once');

-- Tags: only the student's own wrong attempt; the vocabulary grows with the tag.
select is(tag_attempt('a3000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000a3','physics.components','physics','Components'),
          true, 'a wrong attempt gets its error tag');
select is(tag_attempt('a3000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000b3','physics.other','physics','Other'),
          false, 'another student cannot tag it');

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000b3';
select is((select count(*)::int from attempts) + (select count(*)::int from mastery), 0, 'B reads none of A''s evidence');
select throws_ok($$select * from record_attempt(gen_random_uuid(), auth.uid(), '63000000-0000-0000-0000-000000000001', '{}', true)$$,
                 '42501', null, 'clients cannot record attempts (forged correct answers go through /api/sync)');
reset role;

select * from finish();
rollback;
