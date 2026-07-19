# Padel Scorer

Classic match scoring + Americano tournament scoring, with shareable live links via Supabase,
and cross-session lifetime stats (leaderboard, partner records, head-to-head).

## What changed in this version
- **Normalized schema**: players are now persistent identities (`players` table) that link
  across every session they play in, instead of being disposable strings baked into one
  session's JSON blob.
- **Date field**: every session has `played_on` (defaults to today, editable) — set it on
  the home screen before starting, e.g. to log a match that happened yesterday.
- **Stats page** (`/stats`): lifetime leaderboard (games played, wins, win %, total points),
  partner stats (who wins most as a team), head-to-head stats (who wins most as opponents),
  and full session history with dates.
- **Add more rounds**: from the final-standings screen (or the last round), enter a number
  and tap "Add rounds" — extends the Americano schedule fairly, continuing partner/sit-out
  balance from where it left off.
- **Score input visibility bug fixed**: the score entry box always has dark text on a light
  background now.
- **Live shareable links**: every match/tournament gets its own URL (`/session/<id>`).
  Anyone with the link can view live and also enter scores (open by design).

## Setup

### 1. Supabase
Follow `SUPABASE_SETUP.md` — create a project, run the SQL (schema + stats views), grab
your keys. **This is a breaking schema change from the previous single-table version** —
if you ran the old setup, drop the old `sessions` table first (instructions in the doc).

### 2. Local dev
```bash
npm install
cp .env.local.example .env.local
# paste your Supabase URL + anon key into .env.local
npm run dev
```
Visit http://localhost:3000

### 3. Deploy to Vercel
1. Push this project to a GitHub repo.
2. In Vercel: New Project → import the repo.
3. Add the two env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) under Settings → Environment Variables.
4. Deploy. You'll get a URL like `https://your-app.vercel.app`.

### 4. Sharing with other players
Starting a match/tournament creates a session and takes you to `https://your-app.vercel.app/session/<id>`. Copy that URL (or tap **Share** in the app) and send it to the group — they can watch scores update live and can also enter scores themselves.

## Project structure
```
app/
  page.js                 # mode selector (Classic / Americano), date picker, creates a session
  session/[id]/page.js    # the live, shareable scoring page for both modes
  stats/page.js           # lifetime leaderboard, partner & head-to-head stats, session history
lib/
  padelLogic.js           # pure scoring/rotation engine (classic + americano)
  dataStore.js             # Supabase data access: player upsert, round results, stats queries
  supabaseClient.js        # supabase client init
  ui.js                    # shared styles/components
SUPABASE_SETUP.md          # SQL schema + stats views + step-by-step setup
```

## How player identity works
Typing a name (e.g. "Alice") in any session looks up or creates a row in `players` by exact
name match. Every round she plays — in any session, any day — links to that same player id,
so her lifetime stats accumulate automatically. Case-sensitive, exact match: "Alice" and
"alice" are different people. Fine for a small friend group; ask if you want fuzzy/
case-insensitive matching or a manual "merge players" tool later.

## Known limitations (worth knowing)
- No authentication — anyone with a session link can edit it. Fine for casual games; not tamper-proof.
- Undo isn't available in the deployed (server-synced) classic scorer, since history isn't persisted server-side — only the current state is stored. Reset is available instead.
- Classic-mode "players" are really team names (e.g. "Team A"), not individuals — so partner
  stats don't apply to classic matches (nothing to pair), but they still show up in the
  lifetime leaderboard and head-to-head stats under their team name.

