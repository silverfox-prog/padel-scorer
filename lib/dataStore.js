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
export async function createSession({ mode, config, playedOn, scoringState, label }) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      mode,
      config: config || {},
      played_on: playedOn || new Date().toISOString().slice(0, 10),
      scoring_state: scoringState || {},
      status: "active",
      label: label || null,
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
  if (error && error.code !== "23505") throw error;
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

/** Get all rounds for a session with player IDs resolved to names, ready for display. */
export async function getSessionRoundsWithNames(sessionId) {
  const { data: rounds, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("session_id", sessionId)
    .order("round_number", { ascending: true });

  if (error) throw error;
  if (!rounds || rounds.length === 0) return [];

  const playerIds = rounds.flatMap((r) => [
    ...(r.team_a_players || []),
    ...(r.team_b_players || []),
    ...(r.sit_out_players || []),
  ]);
  const names = await resolvePlayerNames(playerIds);

  return rounds.map((r) => ({
    ...r,
    team_a_names: (r.team_a_players || []).map((id) => names[id]),
    team_b_names: (r.team_b_players || []).map((id) => names[id]),
    sit_out_names: (r.sit_out_players || []).map((id) => names[id]),
  }));
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
    .select("id, played_on, created_at, mode, status, label")
    .order("played_on", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

/**
 * Delete a single round by ID.
 */
export async function deleteRound(roundId) {
  const { error } = await supabase.from("rounds").delete().eq("id", roundId);
  if (error) throw error;
}

/**
 * Update a round's scores (and re-link players if team composition changed).
 */
export async function updateRound(roundId, updates) {
  const { teamANames = [], teamBNames = [], sitOutNames = [], scoreA, scoreB } = updates;

  // If team names changed, re-upsert players and update player IDs
  if (teamANames.length || teamBNames.length || sitOutNames.length) {
    const allNames = [...teamANames, ...teamBNames, ...sitOutNames];
    const nameToId = await upsertPlayers(allNames);
    const teamAIds = teamANames.map((n) => nameToId[n.trim()]);
    const teamBIds = teamBNames.map((n) => nameToId[n.trim()]);
    const sitOutIds = sitOutNames.map((n) => nameToId[n.trim()]);

    const { error } = await supabase.from("rounds").update({
      team_a_players: teamAIds,
      team_b_players: teamBIds,
      sit_out_players: sitOutIds,
      score_a: scoreA,
      score_b: scoreB,
    }).eq("id", roundId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("rounds").update({
      score_a: scoreA,
      score_b: scoreB,
    }).eq("id", roundId);
    if (error) throw error;
  }
}

/**
 * Delete an entire session and all its rounds.
 */
export async function deleteSession(sessionId) {
  const { error } = await supabase.from("sessions").delete().eq("id", sessionId);
  if (error) throw error;
}

/**
 * Get all sessions and rounds a player participated in.
 */
export async function getPlayerHistory(playerName) {
  const { data: player, error: findErr } = await supabase
    .from("players")
    .select("id")
    .eq("name", playerName.trim())
    .maybeSingle();

  if (findErr) throw findErr;
  if (!player) return { player: null, rounds: [] };

  const { data: rounds, error: roundsErr } = await supabase
    .from("rounds")
    .select("*, sessions(id, played_on, mode, status)")
    .or(`team_a_players.cs.{${player.id}},team_b_players.cs.{${player.id}},sit_out_players.cs.{${player.id}}`)
    .order("completed_at", { ascending: false });

  if (roundsErr) throw roundsErr;

  return { player, rounds: rounds || [] };
}

  if (error) throw error;

  const playerIds = rounds.flatMap((r) => [
    ...r.team_a_players,
    ...r.team_b_players,
    ...r.sit_out_players,
  ]);
  const names = await resolvePlayerNames(playerIds);

  return rounds.map((r) => ({
    ...r,
    team_a_names: r.team_a_players.map((id) => names[id]),
    team_b_names: r.team_b_players.map((id) => names[id]),
    sit_out_names: r.sit_out_players.map((id) => names[id]),
  }));
}

/**
 * Get the last completed round in a session (for undo).
 */
export async function getLastCompletedRound(sessionId) {
  const { data, error } = await supabase
    .from("rounds")
    .select("*")
    .eq("session_id", sessionId)
    .not("completed_at", "is", null)
    .order("round_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}
