-- H-One — Supabase schema (MVP)
-- Uses UTC storage and enables RLS. Link-token table supports public polls via server endpoints.

create extension if not exists "pgcrypto";

-- Enums
create type timezone_mode as enum ('local','organizer','utc');

-- Profiles (auth-backed)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text,
  tz text,
  created_at timestamptz default now()
);

-- Polls
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  title text,
  description text,
  duration_minutes int not null default 60,
  start_date date not null,
  end_date date not null,
  timezone_mode timezone_mode not null default 'local',
  fairness_mode boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_polls_owner on public.polls(owner_id);

-- Link tokens (public access by URL). Owner can rotate token to invalidate old links.
create table if not exists public.poll_link_tokens (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_poll_link_tokens_poll on public.poll_link_tokens(poll_id);

-- Participants (name required, email optional). Quiet hours default 22:00–07:00.
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  tz text, -- IANA
  quiet_start smallint not null default 22 check (quiet_start between 0 and 23),
  quiet_end smallint not null default 7 check (quiet_end between 0 and 23),
  invited_at timestamptz default now(),
  responded_at timestamptz
);
create index if not exists idx_participants_poll on public.participants(poll_id);

-- Availabilities (UTC)
create table if not exists public.availabilities (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  created_at timestamptz default now(),
  check (end_ts > start_ts)
);
create index if not exists idx_availabilities_poll on public.availabilities(poll_id);
create index if not exists idx_availabilities_participant on public.availabilities(participant_id);
create index if not exists idx_availabilities_range on public.availabilities(start_ts, end_ts);

-- Suggestions
create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  start_ts timestamptz not null,
  end_ts timestamptz not null,
  score numeric not null,
  rationale jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_suggestions_poll_score on public.suggestions(poll_id, score desc);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.polls enable row level security;
alter table public.poll_link_tokens enable row level security;
alter table public.participants enable row level security;
alter table public.availabilities enable row level security;
alter table public.suggestions enable row level security;

-- Policies (owner-centric; anonymous link flows will go via server/edge endpoints using service role)
create policy if not exists "profiles self access" on public.profiles
  for select using (id = auth.uid())
  with check (id = auth.uid());
create policy if not exists "profiles self update" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy if not exists "polls owner full" on public.polls
  for all using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy if not exists "participants owner manage" on public.participants
  for all using (exists (select 1 from public.polls p where p.id = participants.poll_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.polls p where p.id = participants.poll_id and p.owner_id = auth.uid()));

create policy if not exists "availabilities owner manage" on public.availabilities
  for all using (exists (select 1 from public.polls p where p.id = availabilities.poll_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.polls p where p.id = availabilities.poll_id and p.owner_id = auth.uid()));

create policy if not exists "suggestions owner read" on public.suggestions
  for select using (exists (select 1 from public.polls p where p.id = suggestions.poll_id and p.owner_id = auth.uid()));

