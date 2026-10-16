-- P1-02: one job per concept, atomic lesson versions, curator-first for sensitive subjects (RLS).
begin;
create extension if not exists pgtap with schema extensions;

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'e1@x'), ('00000000-0000-0000-0000-0000000000e2', 'e2@x');
update profiles set is_adult = true where id in ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000e2');
select create_concept('test.slope', 'Slope of a curve', 'mathematics', 'introductory', 'd', '{}', '{}', null, null);
select create_concept('test.precedent', 'Judicial precedent', 'law', 'introductory', 'd', '{}', '{}', null, null);

select plan(11);

-- One job per concept; only the first caller is told it created it
select is((select created from enqueue_job_once('lesson_gen', '{}', 'lesson:test', '00000000-0000-0000-0000-0000000000e1')), true, 'the first request creates the job');
select is((select created from enqueue_job_once('lesson_gen', '{}', 'lesson:test', '00000000-0000-0000-0000-0000000000e2')), false, 'a second request joins the same job');
select is((select count(*)::int from jobs where dedupe_key = 'lesson:test'), 1, 'two requests make one job');

-- Versions: review first, then a published v2 supersedes nothing but points the concept at it
select publish_lesson_version((select id from concepts where slug = 'test.slope'), 'topic', '{"title":"v1"}', 'review', 'new', '{}', 0, 'm', null, null, null);
select publish_lesson_version((select id from concepts where slug = 'test.slope'), 'topic', '{"title":"v2"}', 'published', 'new', '{}', 0, 'm', null, null, null);
select is((select version from lessons where spec ->> 'title' = 'v2'), 2, 'a retry after a failed check gets the next version');
select is((select current_lesson_id from concepts where slug = 'test.slope'), (select id from lessons where spec ->> 'title' = 'v2'), 'the concept points at the published version');
select publish_lesson_version((select id from concepts where slug = 'test.slope'), 'topic', '{"title":"v3"}', 'published', 'trusted', '{}', 0, 'm', null, null, '00000000-0000-0000-0000-0000000000e1');
select is((select status::text from lessons where spec ->> 'title' = 'v2'), 'superseded', 'publishing v3 supersedes v2');
select is((select status::text from lessons where spec ->> 'title' = 'v1'), 'review', 'unrelated review versions are left for curators');

-- A sensitive lesson waiting for a curator is invisible to students; superseded versions stay readable
select publish_lesson_version((select id from concepts where slug = 'test.precedent'), 'topic', '{"title":"law"}', 'review', 'new', '{}', 0, 'm', null, null, null);
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e2';
select is((select count(*)::int from lessons where spec ->> 'title' = 'law'), 0, 'a law lesson is not shown before a curator approves it');
select is((select count(*)::int from lessons where spec ->> 'title' = 'v2'), 1, 'v2 stays readable after v3');
select throws_ok($$select publish_lesson_version(gen_random_uuid(), 'topic', '{}', 'published', 'new', '{}', 0, 'm', null, null, null)$$, '42501', null, 'clients cannot publish lessons');
select throws_ok($$select * from enqueue_job_once('lesson_gen', '{}', 'x', null)$$, '42501', null, 'clients cannot enqueue jobs directly');
reset role;

select * from finish();
rollback;
