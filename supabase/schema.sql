-- Relay schema. Run in Supabase SQL editor.
-- Deliberately tiny: teams + batons + cached recaps. No auth (shareable URLs).

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists batons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  author_name text not null,
  audio_url text,
  transcript text,
  card jsonb, -- BatonCard: { summary, items: [{kind, text}], links: [{label, url}] }
  duration_seconds int,
  created_at timestamptz not null default now()
);

create index if not exists batons_team_created_idx on batons (team_id, created_at desc);

-- Cached "catch me up" recaps so replays cost zero API calls.
create table if not exists recaps (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  covers_until timestamptz not null, -- created_at of the newest baton included
  text text not null,
  audio_url text,
  created_at timestamptz not null default now()
);

-- Hackathon tradeoff: RLS on, but fully permissive for anon.
-- Teams are private only by unguessable slug. Fine for a weekend, not for prod.
alter table teams enable row level security;
alter table batons enable row level security;
alter table recaps enable row level security;

create policy "anon read teams" on teams for select using (true);
create policy "anon insert teams" on teams for insert with check (true);
create policy "anon read batons" on batons for select using (true);
create policy "anon insert batons" on batons for insert with check (true);
create policy "anon read recaps" on recaps for select using (true);

-- Storage: create a PUBLIC bucket named "batons" in the dashboard
-- (Storage -> New bucket -> name: batons -> public). Audio files live there.
