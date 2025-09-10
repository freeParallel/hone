-- 001_init.sql
-- Extensions & types
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'timezone_mode') then
    create type timezone_mode as enum ('local','organizer','utc');
  end if;
end $$;

-- Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text,
  tz text,
  created_at timestamptz default now()
);

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

create table if not exists public.poll_link_tokens (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  created_at timestamptz default now()
);
create index if not exists idx_poll_link_tokens_poll on public.poll_link_tokens(poll_id);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null,
  email text,
  tz text,
  quiet_start smallint not null default 22 check (quiet_start between 0 and 23),
  quiet_end smallint not null default 7 check (quiet_end between 0 and 23),
  invited_at timestamptz default now(),
  responded_at timestamptz
);
create index if not exists idx_participants_poll on public.participants(poll_id);

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

alter table public.profiles enable row level security;
alter table public.polls enable row level security;
alter table public.poll_link_tokens enable row level security;
alter table public.participants enable row level security;
alter table public.availabilities enable row level security;
alter table public.suggestions enable row level security;