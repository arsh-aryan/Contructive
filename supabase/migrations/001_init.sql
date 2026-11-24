-- Constructive — initial schema. No user accounts: anonymous read/insert only.

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  place text not null,
  lat double precision not null,
  lng double precision not null,
  baseline jsonb not null,
  works jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id bigint generated always as identity primary key,
  proposal_id uuid not null references public.proposals(id) on delete cascade,
  work_id text not null,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now()
);
create index if not exists votes_proposal_idx on public.votes(proposal_id);

create table if not exists public.area_cache (
  key text primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.proposals enable row level security;
alter table public.votes enable row level security;
alter table public.area_cache enable row level security;

-- Proposals: anyone can create and read (shared by link). No updates/deletes.
create policy "proposals read"   on public.proposals for select using (true);
create policy "proposals insert" on public.proposals for insert with check (jsonb_array_length(works) <= 40);

-- Votes: anyone can vote and read the tally.
create policy "votes read"   on public.votes for select using (true);
create policy "votes insert" on public.votes for insert with check (true);

-- Area cache: public OSM-derived data only.
create policy "cache read"   on public.area_cache for select using (true);
create policy "cache insert" on public.area_cache for insert with check (octet_length(data::text) < 2000000);
create policy "cache update" on public.area_cache for update using (true);
