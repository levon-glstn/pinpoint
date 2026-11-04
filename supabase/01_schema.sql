-- Pinpoint schema. Paste into Supabase Dashboard -> SQL Editor and run once.
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------- countries
create table if not exists public.countries (
  code    text primary key,                        -- cca3, e.g. 'AFG'
  cca2    text not null,
  name    text not null,
  capital text not null,
  lat     double precision not null check (lat between -90 and 90),
  lng     double precision not null check (lng between -180 and 180),
  region  text not null
);

alter table public.countries enable row level security;

drop policy if exists "countries are publicly readable" on public.countries;
create policy "countries are publicly readable"
  on public.countries for select
  to anon, authenticated
  using (true);
-- No insert/update/delete policies: only the dashboard / service role can write.

-- ------------------------------------------------------------------- scores
create table if not exists public.scores (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 24),
  points       int  not null check (points between 0 and 10000),
  created_at   timestamptz not null default now()
);

-- Leaderboard query: order by points desc, oldest first on ties, limit 20.
create index if not exists scores_leaderboard_idx
  on public.scores (points desc, created_at asc);

-- FK column index (the advisor flags unindexed foreign keys).
create index if not exists scores_user_id_idx
  on public.scores (user_id);

alter table public.scores enable row level security;

drop policy if exists "scores are publicly readable" on public.scores;
create policy "scores are publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

-- Anonymous sign-ins get the `authenticated` role, so this covers them too.
-- (select auth.uid()) is wrapped so Postgres evaluates it once, not per row.
drop policy if exists "users insert their own scores" on public.scores;
create policy "users insert their own scores"
  on public.scores for insert
  to authenticated
  with check (user_id = (select auth.uid()));
-- No update/delete policies: scores are immutable once submitted.

-- ------------------------------------------------------------------- grants
-- This project doesn't auto-grant new tables to the API roles, and RLS only
-- filters rows *after* the role has table privileges. Grant the minimum.
grant select on public.countries to anon, authenticated;
grant select on public.scores    to anon, authenticated;
grant insert on public.scores    to authenticated;

-- ----------------------------------------------------------------- realtime
-- Idempotent: only add the table if it isn't already in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table public.scores;
  end if;
end
$$;
