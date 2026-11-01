-- MVP-07 agentic commerce (12 §4 Q63): Ifiok's tutoring agent looks at a student's weak topics and
-- the tutors who teach them, and drafts a booking inside the student's own spending limit. The draft
-- is stored as a proposal; only the student's approval on PayPal creates the hold. Server-written.

-- The most the agent may propose for one session (USD cents in the sandbox, 12 §4 Q61).
create table tutoring_preferences (
  user_id uuid primary key references profiles(id) on delete cascade,
  spend_limit_cents int not null check (spend_limit_cents between 100 and 100000),
  updated_at timestamptz not null default now()
);
alter table tutoring_preferences enable row level security;
create policy tutoring_preferences_read_own on tutoring_preferences for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on tutoring_preferences from anon, authenticated;

create table agent_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  concept_id uuid not null references concepts(id) on delete cascade,
  tutor_id uuid not null references profiles(id) on delete cascade,
  starts_at timestamptz not null,
  price_cents int not null check (price_cents > 0),
  spend_limit_cents int not null check (spend_limit_cents > 0),
  reason text not null check (char_length(reason) between 1 and 600),
  -- What the agent looked at, in counts (shown to the student as its working).
  considered jsonb not null default '{}'::jsonb,
  -- 'ai' when the model's choice passed the server checks; 'rules' when the fallback chose.
  decided_by text not null check (decided_by in ('ai', 'rules')),
  status text not null default 'proposed' check (status in ('proposed', 'booked', 'dismissed')),
  booking_id uuid references tutoring_bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  check (user_id <> tutor_id),
  check (price_cents <= spend_limit_cents)
);
create index agent_proposals_user on agent_proposals (user_id, created_at desc);
alter table agent_proposals enable row level security;
create policy agent_proposals_read_own on agent_proposals for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on agent_proposals from anon, authenticated;

alter table tutoring_bookings add column proposal_id uuid references agent_proposals(id) on delete set null;

insert into app_config (key, value) values ('tutor_agent', '{"default_limit_cents": 1500, "max_weak_topics": 5, "max_tutors": 12}'::jsonb)
on conflict (key) do nothing;
update app_config set value = value || '{"tutor_agent": {"limit": 10}}'::jsonb where key = 'ai_quotas';
update app_config set value = value || '{"tutor_agent": {"provider": "groq", "model": "openai/gpt-oss-120b", "thinking": "low"}}'::jsonb
  where key = 'ai_routes';
