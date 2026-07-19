# Supabase Setup (v2 — normalized schema)

This replaces the single-JSON-blob `sessions` table with a normalized schema so we can
track players persistently across sessions, and compute lifetime stats, win rates, and
head-to-head / partner-pairing records.

If you already ran the v1 setup: this is a clean start (per your answer, old sessions
aren't preserved). Drop the old table first if it exists:

```sql
drop table if exists sessions cascade;
```

## 1. Run the schema
SQL Editor → New query → paste all of this → Run.

```sql
-- ============================================================
-- PLAYERS: persistent identity, reused across sessions
-- ============================================================
create table players (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null unique
);

-- ============================================================
-- SESSIONS: one row per match/tournament. Has its own date field
-- (separate from created_at) so you can log a session for a date
-- other than "now", e.g. backfilling last week's game.
-- ============================================================
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  played_on date not null default current_date,   -- the date field you asked for
  mode text not null check (mode in ('classic', 'americano')),
  status text not null default 'active' check (status in ('active', 'final')),
  config jsonb not null default '{}'::jsonb,        -- goldenPoint, scoringMode, target, etc
  scoring_state jsonb not null default '{}'::jsonb  -- transient/live scoring UI state (current point count etc), NOT the source of truth for finished results
);

-- ============================================================
-- SESSION_PLAYERS: which players took part in a session
-- (lets us list "all sessions Alice played in" without scanning rounds)
-- ============================================================
create table session_players (
  session_id uuid references sessions(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  primary key (session_id, player_id)
);

-- ============================================================
-- ROUNDS: one row per game/round played within a session.
-- Works for both modes:
--  - classic: exactly 1 row (the whole match), team_a/team_b each have 1 player... unless
--    doubles with unnamed players; for classic we still record whichever named teams played.
--  - americano: one row per rotation round, each round has 2v2 with individual players.
-- team_a_players / team_b_players are arrays of player_id (length 1 or 2) to cover both.
-- ============================================================
create table rounds (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  round_number int not null,
  team_a_players uuid[] not null,
  team_b_players uuid[] not null,
  sit_out_players uuid[] not null default '{}',
  score_a int,
  score_b int,
  completed_at timestamptz
);

create index idx_rounds_session on rounds(session_id);
create index idx_session_players_player on session_players(player_id);

-- ============================================================
-- Realtime (for live shared session view)
-- ============================================================
alter publication supabase_realtime add table sessions;
alter publication supabase_realtime add table rounds;

-- ============================================================
-- RLS: open read/write, matching "anyone with the link can edit"
-- ============================================================
alter table players enable row level security;
alter table sessions enable row level security;
alter table session_players enable row level security;
alter table rounds enable row level security;

create policy "open read players" on players for select using (true);
create policy "open write players" on players for insert with check (true);
create policy "open update players" on players for update using (true);

create policy "open read sessions" on sessions for select using (true);
create policy "open write sessions" on sessions for insert with check (true);
create policy "open update sessions" on sessions for update using (true);

create policy "open read session_players" on session_players for select using (true);
create policy "open write session_players" on session_players for insert with check (true);

create policy "open read rounds" on rounds for select using (true);
create policy "open write rounds" on rounds for insert with check (true);
create policy "open update rounds" on rounds for update using (true);
```

## 2. Stats views (optional but recommended — run after the above)

These give you ready-to-query lifetime stats, win rate, and head-to-head/partner data
without hand-rolling the SQL each time in the app.

```sql
-- Lifetime stats per player: points, games played, wins
create view player_stats as
select
  p.id as player_id,
  p.name,
  count(*) filter (where r.score_a is not null) as games_played,
  coalesce(sum(case when r.team_a_players @> array[p.id] then r.score_a
                     when r.team_b_players @> array[p.id] then r.score_b
                     else 0 end), 0) as total_points,
  count(*) filter (
    where (r.team_a_players @> array[p.id] and r.score_a > r.score_b)
       or (r.team_b_players @> array[p.id] and r.score_b > r.score_a)
  ) as wins
from players p
left join rounds r
  on r.team_a_players @> array[p.id] or r.team_b_players @> array[p.id]
group by p.id, p.name;

-- Partner pairing stats: how two players do when on the SAME team together
-- Partner pairing stats: how two players do when on the SAME team together
create view partner_stats as
select
  least(p1, p2) as player_1,
  greatest(p1, p2) as player_2,
  count(*) as games_together,
  count(*) filter (where team_won) as wins_together
from (
  select r.id as round_id, a1 as p1, a2 as p2, (r.score_a > r.score_b) as team_won
  from rounds r,
    lateral (values (r.team_a_players[1], r.team_a_players[2])) as t(a1, a2)
  where r.score_a is not null and array_length(r.team_a_players, 1) = 2
  union all
  select r.id as round_id, b1 as p1, b2 as p2, (r.score_b > r.score_a) as team_won
  from rounds r,
    lateral (values (r.team_b_players[1], r.team_b_players[2])) as t(b1, b2)
  where r.score_a is not null and array_length(r.team_b_players, 1) = 2
) teammates
group by least(p1, p2), greatest(p1, p2);

-- Head-to-head stats: how two players do when on OPPOSING teams
create view head_to_head_stats as
select
  least(p1, p2) as player_1,
  greatest(p1, p2) as player_2,
  count(*) as matches_played,
  count(*) filter (where (p1 = least(p1, p2) and p1_won)) as player_1_wins
from (
  select
    r.id as round_id,
    a_player as p1,
    b_player as p2,
    (r.score_a > r.score_b) as p1_won
  from rounds r
  cross join unnest(r.team_a_players) as a_player
  cross join unnest(r.team_b_players) as b_player
  where r.score_a is not null
) opponents
group by least(p1, p2), greatest(p1, p2);
```

Notes on the views:
- `partner_stats` only pairs players who were on the **same team** in a round (via array
  positions 1 & 2 of `team_a_players`/`team_b_players`), so it won't mistakenly count
  opponents as partners. Classic-mode rounds with only 1 player per team are skipped here
  (nothing to pair) — that's expected, since a 1v1 team has no "partner."
- `head_to_head_stats` only pairs players who were on **opposing** teams (a direct
  `team_a_players` × `team_b_players` cross join per round), so it won't mistakenly count
  teammates as opponents.
- All three are plain SQL views (no materialization), so they always reflect live data —
  fine at this scale; if the player base gets very large we could materialize them later.

## 3. Env vars
Same as before — `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
`.env.local` and in Vercel's project settings.

## What this enables
- **Persistent players**: typing "Alice" in any session reuses the same `players` row
  (matched by name), so her stats accumulate across every session she's played in.
- **Date field**: `sessions.played_on` — defaults to today, but can be set to any date
  (e.g. logging a session you forgot to enter live).
- **Lifetime stats**: `player_stats` view — total points, games played, wins.
- **Partner stats**: `partner_stats` view — who wins most often as a team.
- **Head-to-head**: `head_to_head_stats` view — who beats whom most often as opponents.

## Tradeoffs
- Player identity is matched by exact name (case-sensitive) — "Alice" and "alice" would be
  different people. Fine for a small friend group; ask if you want fuzzy/case-insensitive
  matching or a manual "merge players" tool later.
- Classic (1v1-team) matches are stored as a single `rounds` row per match, with
  `team_a_players`/`team_b_players` holding just the named team's player if you like, or
  can be left empty and only session-level result is tracked — see app code for how it
  populates these when players aren't named individually in classic mode.
