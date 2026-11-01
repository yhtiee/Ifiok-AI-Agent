-- MVP-07 (12 §4 Q43, Q61; 06 §3, §12, §15; 08 §2.7c): PayPal sandbox payouts for contributors and
-- tutoring bookings held by authorisation. Test money only: every row says environment 'sandbox'.
-- Amounts are integer cents of USD (PayPal's sandbox doesn't hold naira, Q61). Nothing here is
-- client-writable; every change goes through a service-role function that is idempotent on its key.

-- ---------------------------------------------------------------------------
-- Payout accounts: a student's PayPal (sandbox) email, used only to pay them (08 §2.7c).
-- ---------------------------------------------------------------------------
create table payout_accounts (
  user_id uuid primary key references profiles(id) on delete cascade,
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  paypal_email text not null check (char_length(paypal_email) between 6 and 254 and paypal_email like '%_@_%._%'),
  updated_at timestamptz not null default now()
);
alter table payout_accounts enable row level security;
create policy payout_accounts_read_own on payout_accounts for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on payout_accounts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Contributor pool payouts (06 §3): one period per month, one line per contributor.
-- ---------------------------------------------------------------------------
create table payout_periods (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  currency text not null default 'USD' check (currency = 'USD'),
  pool_cents bigint not null check (pool_cents >= 0),
  total_points int not null check (total_points >= 0),
  split_cents bigint not null default 0 check (split_cents >= 0),
  carried_cents bigint not null default 0 check (carried_cents >= 0),
  status text not null default 'computed' check (status in ('computed', 'sent')),
  paypal_batch_id text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (month, environment),
  check (split_cents + carried_cents = pool_cents)
);
alter table payout_periods enable row level security;
-- The pool size and month are not personal; who got what is (payout_lines).
create policy payout_periods_read on payout_periods for select to authenticated using (true);
revoke insert, update, delete on payout_periods from anon, authenticated;

create table payout_lines (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references payout_periods(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  points int not null check (points > 0),
  amount_cents bigint not null check (amount_cents > 0),
  capped boolean not null default false,
  status text not null default 'pending'
    check (status in ('pending', 'no_account', 'sent', 'paid', 'unclaimed', 'failed', 'returned')),
  receiver text,
  paypal_item_id text unique,
  explanation text,
  updated_at timestamptz not null default now(),
  unique (period_id, user_id)
);
create index payout_lines_user on payout_lines (user_id);
alter table payout_lines enable row level security;
create policy payout_lines_read_own on payout_lines for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on payout_lines from anon, authenticated;

-- Splits a month's pool by usage points: pool × points / total, at most the cap per contributor
-- (20%, 06 §3); what the cap holds back stays in the pool (carried). Idempotent on the month: a
-- second call returns the period already computed.
create or replace function compute_period(p_month date, p_pool_cents bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_total int;
  v_cap_share numeric := coalesce((select (value ->> 'contributor_cap')::numeric from app_config where key = 'payouts'), 0.2);
  v_cap bigint;
  v_split bigint;
begin
  if p_pool_cents is null or p_pool_cents < 0 then raise exception 'pool must be zero or more'; end if;
  select id into v_id from payout_periods where month = p_month and environment = 'sandbox';
  if v_id is not null then return v_id; end if;

  select count(*) into v_total from usage_points where month = p_month;
  v_cap := floor(p_pool_cents * v_cap_share);
  insert into payout_periods (month, pool_cents, total_points, split_cents, carried_cents)
  values (p_month, p_pool_cents, v_total, 0, p_pool_cents)
  returning id into v_id;

  if v_total > 0 and p_pool_cents > 0 then
    insert into payout_lines (period_id, user_id, points, amount_cents, capped)
    select v_id, contributor_id, n, least(floor(p_pool_cents::numeric * n / v_total)::bigint, v_cap),
           floor(p_pool_cents::numeric * n / v_total)::bigint > v_cap
    from (select contributor_id, count(*)::int as n from usage_points where month = p_month group by contributor_id) s
    where least(floor(p_pool_cents::numeric * n / v_total)::bigint, v_cap) > 0;
  end if;

  select coalesce(sum(amount_cents), 0) into v_split from payout_lines where period_id = v_id;
  update payout_periods set split_cents = v_split, carried_cents = p_pool_cents - v_split where id = v_id;
  return v_id;
end $$;
revoke execute on function compute_period(date, bigint) from public, anon, authenticated;
grant execute on function compute_period(date, bigint) to service_role;

-- Before the batch is sent: lines whose contributor has no PayPal email wait as 'no_account';
-- returns the lines to pay with the receiver as it is now (kept on the line).
create or replace function prepare_payout(p_period uuid)
returns table (line_id uuid, receiver text, amount_cents bigint) language plpgsql security definer set search_path = public as $$
begin
  update payout_lines l set status = 'no_account', updated_at = now()
  where l.period_id = p_period and l.status in ('pending', 'no_account')
    and not exists (select 1 from payout_accounts a where a.user_id = l.user_id);
  update payout_lines l set status = 'pending', receiver = a.paypal_email, updated_at = now()
  from payout_accounts a
  where l.period_id = p_period and a.user_id = l.user_id and l.status in ('pending', 'no_account');
  return query select l.id, l.receiver, l.amount_cents from payout_lines l
    where l.period_id = p_period and l.status = 'pending' order by l.amount_cents desc;
end $$;
revoke execute on function prepare_payout(uuid) from public, anon, authenticated;
grant execute on function prepare_payout(uuid) to service_role;

-- PayPal accepted the batch: the period is sent and its pending lines are on their way.
-- Idempotent on the batch id. Returns the lines marked sent (0 on a replay).
create or replace function mark_period_sent(p_period uuid, p_batch_id text)
returns int language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  update payout_periods set status = 'sent', paypal_batch_id = p_batch_id, sent_at = coalesce(sent_at, now())
  where id = p_period and (paypal_batch_id is null or paypal_batch_id = p_batch_id);
  if not found then raise exception 'period % was sent in another batch', p_period; end if;
  update payout_lines set status = 'sent', updated_at = now() where period_id = p_period and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function mark_period_sent(uuid, text) from public, anon, authenticated;
grant execute on function mark_period_sent(uuid, text) to service_role;

-- A payout item's status from PayPal (fetched from PayPal after a verified webhook). Keyed on the
-- line (PayPal's sender_item_id) and its PayPal item id; returns true only when something changed.
create or replace function record_payout_item(p_line uuid, p_item_id text, p_paypal_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status text := case upper(p_paypal_status)
    when 'SUCCESS' then 'paid'
    when 'UNCLAIMED' then 'unclaimed'
    when 'FAILED' then 'failed' when 'BLOCKED' then 'failed' when 'DENIED' then 'failed'
    when 'RETURNED' then 'returned' when 'REFUNDED' then 'returned' when 'REVERSED' then 'returned'
    else 'sent' end;
begin
  update payout_lines set status = v_status, paypal_item_id = coalesce(paypal_item_id, p_item_id), updated_at = now()
  where id = p_line and status in ('sent', 'paid', 'unclaimed', 'failed', 'returned')
    and (paypal_item_id is null or paypal_item_id = p_item_id)
    and status <> v_status;
  return found;
end $$;
revoke execute on function record_payout_item(uuid, text, text) from public, anon, authenticated;
grant execute on function record_payout_item(uuid, text, text) to service_role;

-- The AI's plain-words explanation of a line (numbers come from the line itself, 10 MVP-07).
create or replace function set_payout_explanation(p_line uuid, p_text text)
returns void language sql security definer set search_path = public as $$
  update payout_lines set explanation = left(p_text, 600) where id = p_line;
$$;
revoke execute on function set_payout_explanation(uuid, text) from public, anon, authenticated;
grant execute on function set_payout_explanation(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Tutoring (F17, 06 §12, §15): the learner's PayPal order is authorised at booking (held, nothing
-- captured), captured after the session, and the tutor is paid out minus the take rate.
-- ---------------------------------------------------------------------------
alter table tutor_profiles add column price_cents int check (price_cents is null or price_cents between 100 and 100000);

create table tutoring_bookings (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  learner_id uuid not null references profiles(id) on delete cascade,
  tutor_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  starts_at timestamptz not null,
  minutes int not null check (minutes between 15 and 180),
  currency text not null default 'USD' check (currency = 'USD'),
  price_cents int not null check (price_cents > 0),
  take_rate_bp int not null check (take_rate_bp between 0 and 5000),
  status text not null default 'awaiting_payment' check (status in
    ('awaiting_payment', 'authorized', 'captured', 'paid_out', 'voided', 'disputed', 'cancelled', 'failed')),
  proposed_by text not null default 'learner' check (proposed_by in ('learner', 'agent')),
  agent_reason text check (char_length(agent_reason) <= 400),
  paypal_order_id text unique,
  paypal_authorization_id text unique,
  paypal_capture_id text unique,
  tutor_payout_item_id text unique,
  tutor_payout_status text check (tutor_payout_status in ('sent', 'paid', 'unclaimed', 'failed', 'returned')),
  released_by text check (released_by in ('learner', 'auto', 'admin')),
  note text check (char_length(note) <= 400),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (learner_id <> tutor_id)
);
create index tutoring_bookings_learner on tutoring_bookings (learner_id, created_at desc);
create index tutoring_bookings_tutor on tutoring_bookings (tutor_id, created_at desc);
alter table tutoring_bookings enable row level security;
create policy tutoring_bookings_read_party on tutoring_bookings for select to authenticated
  using (learner_id = auth.uid() or tutor_id = auth.uid());
revoke insert, update, delete on tutoring_bookings from anon, authenticated;

-- One state machine for every booking change (06 §12). p_ref is the PayPal id for the step (order,
-- authorisation, capture or payout item); p_note the release source or the dispute reason. A
-- replay of a step already taken, or a step the booking can't take, changes nothing and returns false.
create or replace function booking_step(p_booking uuid, p_to text, p_ref text default null, p_note text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  b tutoring_bookings;
  v_from text[];
begin
  select * into b from tutoring_bookings where id = p_booking for update;
  if b.id is null then return false; end if;
  v_from := case p_to
    when 'ordered' then array['awaiting_payment']
    when 'authorized' then array['awaiting_payment']
    when 'captured' then array['authorized', 'disputed']
    when 'paid_out' then array['captured']
    when 'voided' then array['authorized', 'disputed']
    when 'disputed' then array['authorized']
    when 'cancelled' then array['awaiting_payment']
    when 'failed' then array['awaiting_payment']
    else null end;
  if v_from is null then raise exception 'unknown booking step %', p_to; end if;
  if not (b.status = any (v_from)) then return false; end if;

  if p_to = 'ordered' then
    if b.paypal_order_id is not null then return false; end if;
    update tutoring_bookings set paypal_order_id = p_ref, updated_at = now() where id = p_booking;
    return true;
  end if;
  update tutoring_bookings set
    status = p_to,
    paypal_authorization_id = case when p_to = 'authorized' then p_ref else paypal_authorization_id end,
    paypal_capture_id = case when p_to = 'captured' then p_ref else paypal_capture_id end,
    tutor_payout_item_id = case when p_to = 'paid_out' then p_ref else tutor_payout_item_id end,
    tutor_payout_status = case when p_to = 'paid_out' then 'sent' else tutor_payout_status end,
    released_by = case when p_to = 'captured' then coalesce(p_note, 'learner') else released_by end,
    note = case when p_to in ('disputed', 'voided', 'cancelled', 'failed') then coalesce(p_note, note) else note end,
    updated_at = now()
  where id = p_booking;
  return true;
end $$;
revoke execute on function booking_step(uuid, text, text, text) from public, anon, authenticated;
grant execute on function booking_step(uuid, text, text, text) to service_role;

-- The tutor's payout item status from PayPal (after a verified webhook), keyed on the item id.
create or replace function record_tutor_payout(p_booking uuid, p_item_id text, p_paypal_status text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_status text := case upper(p_paypal_status)
    when 'SUCCESS' then 'paid' when 'UNCLAIMED' then 'unclaimed'
    when 'FAILED' then 'failed' when 'BLOCKED' then 'failed' when 'DENIED' then 'failed'
    when 'RETURNED' then 'returned' when 'REFUNDED' then 'returned' when 'REVERSED' then 'returned'
    else 'sent' end;
begin
  update tutoring_bookings set tutor_payout_status = v_status, updated_at = now()
  where id = p_booking and status = 'paid_out'
    and (tutor_payout_item_id = p_item_id or tutor_payout_item_id is null)
    and tutor_payout_status is distinct from v_status;
  return found;
end $$;
revoke execute on function record_tutor_payout(uuid, text, text) from public, anon, authenticated;
grant execute on function record_tutor_payout(uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Webhook events seen (08 §2.7c): a replayed event id is recognised and ignored.
-- ---------------------------------------------------------------------------
create table paypal_events (
  event_id text primary key,
  event_type text not null,
  environment text not null default 'sandbox' check (environment = 'sandbox'),
  received_at timestamptz not null default now()
);
alter table paypal_events enable row level security;
revoke all on paypal_events from anon, authenticated;

create or replace function paypal_event_once(p_event_id text, p_type text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  insert into paypal_events (event_id, event_type) values (p_event_id, p_type) on conflict do nothing;
  return found;
end $$;
revoke execute on function paypal_event_once(text, text) from public, anon, authenticated;
grant execute on function paypal_event_once(text, text) to service_role;

-- Auto-release 24 h after a session (06 §12): a job per booking that waits until it's due.
select pgmq.create('tutoring_release');

insert into app_config (key, value) values
  ('payouts', '{"currency": "USD", "contributor_cap": 0.2, "demo_pool_cents": 5000}'::jsonb),
  ('tutoring', '{"take_rate": 0.15, "price_min_cents": 300, "price_max_cents": 5000, "auto_release_hours": 24, "session_minutes": 45}'::jsonb)
on conflict (key) do nothing;

-- The AI explains a payout line in plain words, from the recorded numbers (10 MVP-07).
update app_config set value = value || '{"payout_explain": {"limit": 20}}'::jsonb where key = 'ai_quotas';
update app_config set value = value || '{"payout_explain": {"provider": "groq", "model": "openai/gpt-oss-20b", "thinking": "low"}}'::jsonb
  where key = 'ai_routes';
