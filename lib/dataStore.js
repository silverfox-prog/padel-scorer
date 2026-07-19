import { supabase } from "./supabaseClient";

/**
 * Get-or-create a player by name. Names are the identity key (case-sensitive, trimmed).
 * Returns the player row { id, name }.
 */
export async function upsertPlayer(name) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Player name cannot be empty");

  // Try to find existing first (avoids relying on upsert conflict semantics for reads).
  const { data: existing, error: findErr } = await supabase
    .from("players")
    .select("id, name")
    .eq("name", trimmed)
    .maybeSingle();

  if (findErr) throw findErr;
  if (existing) return existing;

  const { data: created, error: insertErr } = await supabase
    .from("players")
    .insert({ name: trimmed })
    .select("id, name")
    .single();

  if (insertErr) {
    // Handle race: someone else created it between our check and insert.
    if (insertErr.code === "23505") {
      const { data: retry, error: retryErr } = await supabase
        .from("players")
        .select("id, name")
        .eq("name", trimmed)
        .single();
      if (retryErr) throw retryErr;
      return retry;
    }
    throw insertErr;
  }
  return created;
}

/**
 * Ensure a list of player names all exist, return a map of name -> player_id.
 */
export async function upsertPlayers(names) {
  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const results = await Promise.all(uniqueNames.map((n) => upsertPlayer(n)));
  const map = {};
  results.forEach((p) => (map[p.name] = p.id));
  return map;
}

/**
 * Create a new session row. playedOn is an ISO date string (YYYY-MM-DD); defaults to today.
 */
export async function createSession({ mode, config, playedOn, scoringState }) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      mode,
      config: config || {},
      played_on: playedOn || new Date().toISOString().slice(0, 10),
      scoring_state: scoringState || {},
      status: "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function linkPlayersToSession(sessionId, playerIds) {
  const rows = [...new Set(playerIds)].map((player_id) => ({ session_id: sessionId, player_id }));
  if (rows.length === 0) return;
  const { error } = await supabase.from("session_players").insert(rows);
  if (error && error.code !== "23505") throw error; // ignore duplicate-link races
}

/**
 * Upsert a round's result (by session_id + round_number). Player name arrays are resolved
 * to player_ids via upsertPlayers first.
 */
export async function saveRoundResult({
  sessionId,
  roundNumber,
  teamANames,
  teamBNames,
  sitOutNames = [],
  scoreA,
  scoreB,
}) {
  const allNames = [...teamANames, ...teamBNames, ...sitOutNames];
  const nameToId = await upsertPlayers(allNames);
  await linkPlayersToSession(sessionId, Object.values(nameToId));

  const teamAIds = teamANames.map((n) => nameToId[n.trim()]);
  const teamBIds = teamBNames.map((n) => nameToId[n.trim()]);
  const sitOutIds = sitOutNames.map((n) => nameToId[n.trim()]);

  // Upsert-by-natural-key: try update first, insert if no row affected.
  const { data: existingRound } = await supabase
    .from("rounds")
    .select("id")
    .eq("session_id", sessionId)
    .eq("round_number", roundNumber)
    .maybeSingle();

  const payload = {
    session_id: sessionId,
    round_number: roundNumber,
    team_a_players: teamAIds,
    team_b_players: teamBIds,
    sit_out_players: sitOutIds,
    score_a: scoreA,
    score_b: scoreB,
    completed_at: scoreA != null && scoreB != null ? new Date().toISOString() : null,
  };

  if (existingRound) {
    const { error } = await supabase.from("rounds").update(payload).eq("id", existingRound.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("rounds").insert(payload);
    if (error) throw error;
  }
}

export async function getSessionRounds(sessionId) {
  const { data, error } = await supabase
    .from("rounds")
    .select("*, team_a_names:team_a_players, team_b_names:team_b_players")
    .eq("session_id", sessionId)
    .order("round_number", { ascending: true });
  if (error) throw error;
  return data;
}

/** Resolve an array of player_ids to names in one query, returns { [id]: name }. */
export async function resolvePlayerNames(playerIds) {
  const uniqueIds = [...new Set(playerIds.filter(Boolean))];
  if (uniqueIds.length === 0) return {};
  const { data, error } = await supabase.from("players").select("id, name").in("id", uniqueIds);
  if (error) throw error;
  const map = {};
  data.forEach((p) => (map[p.id] = p.name));
  return map;
}

/** Lifetime stats for a player by name (uses the player_stats SQL view). */
export async function getPlayerStats(name) {
  const { data, error } = await supabase.from("player_stats").select("*").eq("name", name.trim()).maybeSingle();
  if (error) throw error;
  return data;
}

/** All-time leaderboard (uses the player_stats SQL view). */
export async function getAllPlayerStats() {
  const { data, error } = await supabase
    .from("player_stats")
    .select("*")
    .order("total_points", { ascending: false });
  if (error) throw error;
  return data;
}

/** Partner (teammate) stats between all pairs, resolved to names. */
export async function getPartnerStats() {
  const { data, error } = await supabase.from("partner_stats").select("*");
  if (error) throw error;
  const ids = data.flatMap((r) => [r.player_1, r.player_2]);
  const names = await resolvePlayerNames(ids);
  return data.map((r) => ({
    ...r,
    player_1_name: names[r.player_1],
    player_2_name: names[r.player_2],
  }));
}

/** Head-to-head (opponent) stats between all pairs, resolved to names. */
export async function getHeadToHeadStats() {
  const { data, error } = await supabase.from("head_to_head_stats").select("*");
  if (error) throw error;
  const ids = data.flatMap((r) => [r.player_1, r.player_2]);
  const names = await resolvePlayerNames(ids);
  return data.map((r) => ({
    ...r,
    player_1_name: names[r.player_1],
    player_2_name: names[r.player_2],
  }));
}

/** List past sessions with dates, most recent first. */
export async function getSessionHistory(limit = 50) {
  const { data, error } = await supabase
    .from("sessions")
    .select("id, played_on, created_at, mode, status")
    .order("played_on", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
