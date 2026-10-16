-- P0-11 job runtime: pgmq queue behind `jobs`, claims with a visibility timeout, retries, final
-- failure, deferral, the sweeper and the wake trigger. Runs inside a rolled-back transaction, so
-- the live worker never sees these messages.
begin;
create extension if not exists pgtap with schema extensions;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'f1@x');

select plan(20);

-- Enqueue: one job and one message, even when the same dedupe key arrives twice
select enqueue_job('noop', '{"n":1}', 'noop:test-a', '00000000-0000-0000-0000-0000000000f1');
select enqueue_job('noop', '{"n":1}', 'noop:test-a', '00000000-0000-0000-0000-0000000000f1');
select is((select count(*)::int from jobs where dedupe_key = 'noop:test-a'), 1, 'the same dedupe key twice makes one job');

create temp table claimed as select * from worker_read('noop', 180, 5) where false;
insert into claimed select * from worker_read('noop', 180, 5);
select is((select count(*)::int from claimed where job_id = (select id from jobs where dedupe_key = 'noop:test-a')), 1, 'one message per job');
select is((select status::text from jobs where dedupe_key = 'noop:test-a'), 'running', 'a claim marks the job running');
select is((select attempts::int from jobs where dedupe_key = 'noop:test-a'), 1, 'a claim counts the attempt');
select is((select count(*)::int from worker_read('noop', 180, 5)), 0, 'a claimed message is invisible to other runners');

-- Complete: done, and the message is gone
select worker_complete('noop', (select msg_id from claimed limit 1), (select job_id from claimed limit 1), '{"ok":true}');
select is((select status::text from jobs where dedupe_key = 'noop:test-a'), 'done', 'completing marks the job done');
select is((select result ->> 'ok' from jobs where dedupe_key = 'noop:test-a'), 'true', 'the result is saved');

-- A crashed run (no complete/fail) reappears once its visibility timeout passes
truncate claimed;
select enqueue_job('noop', '{}', 'noop:test-b', null);
insert into claimed select * from worker_read('noop', 0, 1);
select is((select count(*)::int from claimed), 1, 'the job is claimed');
truncate claimed;
insert into claimed select * from worker_read('noop', 180, 1);
select is((select attempts::int from claimed), 2, 'after the visibility timeout a crashed run is claimed again (attempt 2)');

-- Failure: retry first, then final
select worker_fail('noop', (select msg_id from claimed), (select job_id from claimed), 'try again', false, 0);
select is((select status::text from jobs where dedupe_key = 'noop:test-b'), 'queued', 'a failed attempt goes back to queued');
truncate claimed;
insert into claimed select * from worker_read('noop', 180, 1);
select is((select attempts::int from claimed), 3, 'the retry is claimed again');
select worker_fail('noop', (select msg_id from claimed), (select job_id from claimed), 'gave up', true, 0);
select is((select status::text from jobs where dedupe_key = 'noop:test-b'), 'failed', 'the last attempt ends the job failed');
select is((select error from jobs where dedupe_key = 'noop:test-b'), 'gave up', 'the student-facing error is saved');
select is((select count(*)::int from worker_read('noop', 0, 5)), 0, 'a failed job''s message is archived');

-- Defer: parked without counting a failure
truncate claimed;
select enqueue_job('noop', '{}', 'noop:test-c', null);
insert into claimed select * from worker_read('noop', 180, 1);
select worker_defer('noop', (select msg_id from claimed), (select job_id from claimed), 3600, '{"waiting":"library_budget"}');
select is((select status::text || ':' || attempts from jobs where dedupe_key = 'noop:test-c'), 'queued:0', 'a deferred job is queued and the attempt is not counted');
select is((select count(*)::int from worker_read('noop', 180, 5)), 0, 'a deferred job stays hidden until its time');

-- Sweeper and wake trigger
select is((select schedule from cron.job where jobname = 'ifiok-worker-sweep'), '* * * * *', 'the sweeper runs every minute');
select has_trigger('jobs', 'jobs_wake', 'a new job wakes the worker');

-- Clients can't touch the queue
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
select throws_ok($$select * from worker_read('noop', 180, 1)$$, '42501', null, 'clients cannot claim jobs');
select throws_ok($$select enqueue_job('payouts', '{}', null, null)$$, '42501', null, 'clients cannot enqueue directly (payouts included)');
reset role;

select * from finish();
rollback;
