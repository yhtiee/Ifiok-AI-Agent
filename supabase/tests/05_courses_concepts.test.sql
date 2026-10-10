-- P1-01: course search and duplicates, concept matching, concept slugs, outline application.
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'd1@x'), ('00000000-0000-0000-0000-0000000000d2', 'd2@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2');
insert into universities (id, name, short_name) values
 ('10000000-0000-0000-0000-0000000000d1', 'Test Uni A', 'T-A'), ('10000000-0000-0000-0000-0000000000d2', 'Test Uni B', 'T-B');
insert into courses (id, university_id, code, title, subject, created_by) values
 ('20000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-0000000000d1', 'MTH 101', 'Elementary Mathematics I', 'mathematics', '00000000-0000-0000-0000-0000000000d1'),
 ('20000000-0000-0000-0000-0000000000d2', '10000000-0000-0000-0000-0000000000d1', 'PHY 101', 'General Physics I', 'physics', '00000000-0000-0000-0000-0000000000d1'),
 ('20000000-0000-0000-0000-0000000000d3', '10000000-0000-0000-0000-0000000000d2', 'MTH 101', 'Calculus', 'mathematics', '00000000-0000-0000-0000-0000000000d2');
insert into enrollments (user_id, course_id) values ('00000000-0000-0000-0000-0000000000d1', '20000000-0000-0000-0000-0000000000d1'), ('00000000-0000-0000-0000-0000000000d2', '20000000-0000-0000-0000-0000000000d1');

select plan(18);

-- Subjects and config
select ok((select sensitive from subjects where code = 'law'), 'law is a sensitive subject');
select ok((select not sensitive from subjects where code = 'mathematics'), 'mathematics is not sensitive');
select is((select value ->> '200' from app_config where key = 'level_bands'), 'intermediate', '200 level maps to the intermediate band');

-- Course search: code variants, title words, only this university, member counts
select is((select code from search_courses('10000000-0000-0000-0000-0000000000d1', 'mth101') limit 1), 'MTH 101', 'code search ignores spaces and case');
select is((select members from search_courses('10000000-0000-0000-0000-0000000000d1', 'MTH 101') limit 1), 2::bigint, 'search shows how many classmates are in a course');
select is((select count(*)::int from search_courses('10000000-0000-0000-0000-0000000000d1', 'mth 101')), 1, 'search stays at the student''s university');
select is((select code from search_courses('10000000-0000-0000-0000-0000000000d1', 'elementary mathematics') limit 1), 'MTH 101', 'title search finds the course');
select is((select code from search_courses('10000000-0000-0000-0000-0000000000d1', 'Elementery Mathematic') limit 1), 'MTH 101', 'near-duplicate titles are found (typos)');
select throws_ok($$insert into courses (university_id, code, title) values ('10000000-0000-0000-0000-0000000000d1', 'mth-101', 'Again')$$, '23505', null, 'the same code twice at one university is rejected (normalised)');

-- Concepts: matching and slugs
select create_concept('calculus.limits', 'Limits of a function', 'mathematics', 'introductory', 'd', '{}', '{}', (array_fill(0.0::real, array[383]) || array[1.0::real])::extensions.vector, null);
select is((select count(*)::int from concepts where slug = 'calculus.limits'), 1, 'a concept is created');
select isnt(create_concept('calculus.limits', 'Limits again', 'mathematics', 'introductory', 'd', '{}', '{}', null, null), null, 'a slug conflict still creates the concept');
select ok(exists (select 1 from concepts where slug = 'calculus.limits-2'), 'the conflicting slug gets a numeric suffix');
select is((select title from match_concepts((array_fill(0.0::real, array[383]) || array[1.0::real])::extensions.vector, 'mathematics', 'introductory') limit 1), 'Limits of a function', 'the nearest concept by embedding comes first');
select is((select count(*)::int from match_concepts((array_fill(0.0::real, array[383]) || array[1.0::real])::extensions.vector, 'physics', 'introductory')), 0, 'matching stays inside the subject');

-- Outlines: apply, reorder, archive (never delete)
select apply_outline('20000000-0000-0000-0000-0000000000d1', jsonb_build_array(
  jsonb_build_object('concept_id', (select id from concepts where slug = 'calculus.limits'), 'title', 'Limits', 'week', 1),
  jsonb_build_object('concept_id', (select id from concepts where slug = 'calculus.limits-2'), 'title', 'Continuity', 'week', 2)));
select is((select array_agg(title order by position) from topics where course_id = '20000000-0000-0000-0000-0000000000d1' and archived_at is null), array['Limits', 'Continuity'], 'an outline creates ordered topics');
select apply_outline('20000000-0000-0000-0000-0000000000d1', jsonb_build_array(
  jsonb_build_object('topic_id', (select id from topics where title = 'Continuity' and course_id = '20000000-0000-0000-0000-0000000000d1'), 'concept_id', (select id from concepts where slug = 'calculus.limits-2'), 'title', 'Continuity', 'week', 1)));
select is((select array_agg(title order by position) from topics where course_id = '20000000-0000-0000-0000-0000000000d1' and archived_at is null), array['Continuity'], 'removed topics leave the outline');
select is((select count(*)::int from topics where course_id = '20000000-0000-0000-0000-0000000000d1'), 2, 'removed topics are archived, never deleted');

-- Clients can't call these
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
select throws_ok($$select * from search_courses('10000000-0000-0000-0000-0000000000d1', 'mth')$$, '42501', null, 'clients search through the server route');
reset role;

select * from finish();
rollback;
