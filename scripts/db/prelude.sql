-- Minimal stand-in for what Supabase provides, so migrations and pgTAP tests run in PGlite
-- (scripts/db-test.mts). Mirrors specifications/checks/prelude.sql. Not used against Supabase.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}',
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                  nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

create schema if not exists extensions;
grant usage on schema public, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

-- Stand-ins for pgmq, pg_net, pg_cron and Vault (P0-11). The test runner skips their
-- `create extension` lines; these keep the same function signatures the migrations call, with
-- enough behaviour (visibility timeouts, archiving, recorded HTTP calls) for pgTAP.
create schema pgmq;
create table pgmq._messages (
  queue text not null,
  msg_id bigint generated always as identity primary key,
  read_ct int not null default 0,
  enqueued_at timestamptz not null default clock_timestamp(),
  vt timestamptz not null default clock_timestamp(),
  message jsonb not null,
  archived boolean not null default false
);
create table pgmq._queues (name text primary key);
create function pgmq.create(queue_name text) returns void language sql as $$
  insert into pgmq._queues values (queue_name) on conflict do nothing $$;
create function pgmq.send(queue_name text, msg jsonb, delay int default 0) returns setof bigint language sql as $$
  insert into pgmq._messages (queue, message, vt) values (queue_name, msg, clock_timestamp() + make_interval(secs => delay))
  returning msg_id $$;
create function pgmq.read(queue_name text, vt int, qty int)
returns table (msg_id bigint, read_ct int, enqueued_at timestamptz, vt timestamptz, message jsonb) language sql as $$
  update pgmq._messages m set vt = clock_timestamp() + make_interval(secs => read.vt), read_ct = m.read_ct + 1
  where m.msg_id in (select x.msg_id from pgmq._messages x
                     where x.queue = queue_name and not x.archived and x.vt <= clock_timestamp()
                     order by x.msg_id limit qty)
  returning m.msg_id, m.read_ct, m.enqueued_at, m.vt, m.message $$;
create function pgmq.archive(queue_name text, msg_id bigint) returns boolean language sql as $$
  update pgmq._messages m set archived = true where m.queue = queue_name and m.msg_id = archive.msg_id returning true $$;
create function pgmq.set_vt(queue_name text, msg_id bigint, vt int)
returns table (msg_id bigint, read_ct int, enqueued_at timestamptz, vt timestamptz, message jsonb) language sql as $$
  update pgmq._messages m set vt = clock_timestamp() + make_interval(secs => set_vt.vt)
  where m.queue = queue_name and m.msg_id = set_vt.msg_id
  returning m.msg_id, m.read_ct, m.enqueued_at, m.vt, m.message $$;

create schema net;
create table net._calls (id bigint generated always as identity primary key, url text, body jsonb, headers jsonb);
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}',
                              timeout_milliseconds int default 5000) returns bigint language sql as $$
  insert into net._calls (url, body, headers) values (url, body, headers) returning id $$;

create schema cron;
create table cron.job (jobid bigint generated always as identity primary key, jobname text unique, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;

create schema vault;
create table vault.secrets (name text primary key, secret text not null);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
