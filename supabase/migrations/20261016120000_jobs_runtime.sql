-- P0-11 job system (02 §4): pgmq queues, a pg_net trigger that wakes the worker Edge Function,
-- a pg_cron sweeper, and the worker's SQL API. Extensions are enabled here, where they're first
-- used (12 §4 Q14). PGlite (pnpm test:db:local) gets stand-ins from scripts/db/prelude.sql.

create extension if not exists pgmq;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- One queue per job type (02 §4).
do $$
declare q text;
begin
  foreach q in array array['lesson_gen','items_gen','ocr','curate','mark_transcribe','mark_verify',
                           'exam_extract','embed','notify','payouts','noop'] loop
    perform pgmq.create(q);
  end loop;
end $$;

-- Enqueue: a jobs row (status, visible to its owner) plus a pgmq message pointing at it.
create or replace function enqueue_job(p_queue text, p_payload jsonb, p_dedupe text default null, p_owner uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into jobs (queue, owner_id, dedupe_key, payload) values (p_queue, p_owner, p_dedupe, p_payload)
  on conflict (dedupe_key) where status in ('queued','running') do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from jobs where dedupe_key = p_dedupe and status in ('queued','running');
    return v_id;
  end if;
  perform pgmq.send(p_queue, jsonb_build_object('job_id', v_id));
  return v_id;
end $$;

create or replace function enqueue_job_once(p_queue text, p_payload jsonb, p_dedupe text, p_owner uuid default null)
returns table (job_id uuid, created boolean) language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into jobs (queue, owner_id, dedupe_key, payload) values (p_queue, p_owner, p_dedupe, p_payload)
  on conflict (dedupe_key) where status in ('queued','running') do nothing
  returning id into v_id;
  if v_id is not null then
    perform pgmq.send(p_queue, jsonb_build_object('job_id', v_id));
    return query select v_id, true;
    return;
  end if;
  return query select j.id, false from jobs j where j.dedupe_key = p_dedupe and j.status in ('queued','running');
end $$;

-- Claim up to p_qty messages for p_vt seconds. Each claim marks its job running and counts the
-- attempt; a crashed run's message reappears after p_vt and is claimed again (attempt + 1).
-- Messages whose job has finished or vanished are archived and skipped.
create or replace function worker_read(p_queue text, p_vt int, p_qty int)
returns table (msg_id bigint, job_id uuid, attempts smallint, owner_id uuid, payload jsonb)
language plpgsql security definer set search_path = public as $$
declare m record; j jobs;
begin
  for m in select r.msg_id, r.message from pgmq.read(p_queue, p_vt, p_qty) r loop
    update jobs set status = 'running', attempts = jobs.attempts + 1, updated_at = now()
    where id = (m.message ->> 'job_id')::uuid and status in ('queued','running')
    returning * into j;
    if j.id is null then
      perform pgmq.archive(p_queue, m.msg_id);
      continue;
    end if;
    msg_id := m.msg_id; job_id := j.id; attempts := j.attempts; owner_id := j.owner_id; payload := j.payload;
    return next;
    j := null;
  end loop;
end $$;

create or replace function worker_complete(p_queue text, p_msg_id bigint, p_job uuid, p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update jobs set status = 'done', result = p_result, error = null, updated_at = now() where id = p_job;
  perform pgmq.archive(p_queue, p_msg_id);
end $$;

-- A failed attempt: final ends the job 'failed' (the student sees a retry); otherwise it goes back
-- to 'queued' and its message reappears after p_retry_after seconds.
create or replace function worker_fail(p_queue text, p_msg_id bigint, p_job uuid, p_error text, p_final boolean,
                                       p_retry_after int default 30)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_final then
    update jobs set status = 'failed', error = p_error, updated_at = now() where id = p_job;
    perform pgmq.archive(p_queue, p_msg_id);
  else
    update jobs set status = 'queued', error = p_error, updated_at = now() where id = p_job;
    perform pgmq.set_vt(p_queue, p_msg_id, greatest(p_retry_after, 0));
  end if;
end $$;

-- Park a job without counting a failure (e.g. the library budget is used up until midnight).
create or replace function worker_defer(p_queue text, p_msg_id bigint, p_job uuid, p_seconds int, p_result jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update jobs set status = 'queued', result = p_result, attempts = greatest(jobs.attempts - 1, 0), updated_at = now()
  where id = p_job;
  perform pgmq.set_vt(p_queue, p_msg_id, greatest(p_seconds, 1));
end $$;

-- Wake the worker Edge Function (async HTTP via pg_net). The URL and shared secret live in Vault
-- (`worker_url`, `internal_function_secret`; set once with scripts/setup-worker.mts). Until they
-- exist this does nothing, so migrations and tests run anywhere.
create or replace function wake_worker(p_queue text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'worker_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'internal_function_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := case when p_queue is null then '{}'::jsonb else jsonb_build_object('queue', p_queue) end,
    headers := jsonb_build_object('content-type', 'application/json', 'x-ifiok-secret', v_secret),
    timeout_milliseconds := 5000
  );
end $$;

create or replace function jobs_wake_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform wake_worker(new.queue);
  return new;
end $$;

drop trigger if exists jobs_wake on jobs;
create trigger jobs_wake after insert on jobs for each row execute function jobs_wake_trigger();

-- Sweeper: every minute, wake the worker for anything a dropped trigger, a retry backoff or a
-- deferral left waiting (02 §4).
select cron.schedule('ifiok-worker-sweep', '* * * * *', 'select public.wake_worker()');

-- Clients watch their own jobs over Realtime (RLS applies: owner only).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'jobs') then
    alter publication supabase_realtime add table jobs;
  end if;
end $$;

-- The P1-02 stopgap runner's claim (Next `after()`) is replaced by pgmq visibility timeouts.
drop function if exists claim_job(uuid, int);

revoke execute on function enqueue_job(text, jsonb, text, uuid), enqueue_job_once(text, jsonb, text, uuid),
  worker_read(text, int, int), worker_complete(text, bigint, uuid, jsonb),
  worker_fail(text, bigint, uuid, text, boolean, int), worker_defer(text, bigint, uuid, int, jsonb),
  wake_worker(text), jobs_wake_trigger()
  from public, anon, authenticated;
grant execute on function enqueue_job(text, jsonb, text, uuid), enqueue_job_once(text, jsonb, text, uuid),
  worker_read(text, int, int), worker_complete(text, bigint, uuid, jsonb),
  worker_fail(text, bigint, uuid, text, boolean, int), worker_defer(text, bigint, uuid, int, jsonb),
  wake_worker(text)
  to service_role;
