/* ============================== CLASSIC ENGINE ============================== */
export const POINT_NAMES = ["0", "15", "30", "40"];

export function initClassicState(opts = {}) {
  return {
    goldenPoint: !!opts.goldenPoint,
    teamNames: opts.teamNames || { A: "Team A", B: "Team B" },
    server: "A",
    points: { A: 0, B: 0 },
    games: { A: 0, B: 0 },
    sets: [],
    tiebreak: null,
    matchWinner: null,
    setWinner: null,
  };
}
export function other(t) {
  return t === "A" ? "B" : "A";
}
function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}
export function pointName(state, team) {
  if (state.tiebreak) return String(state.tiebreak[team]);
  const p = state.points[team];
  const op = state.points[other(team)];
  if (p >= 3 && op >= 3) {
    if (p === op) return "40";
    if (p === op + 1) return "Ad";
    return "40";
  }
  return POINT_NAMES[p] ?? "40";
}
function checkGameWin(state) {
  const { A, B } = state.points;
  if (A >= 4 && A - B >= 2) return "A";
  if (B >= 4 && B - A >= 2) return "B";
  return null;
}
function checkTiebreakWin(state) {
  const { A, B } = state.tiebreak;
  if (A >= 7 && A - B >= 2) return "A";
  if (B >= 7 && B - A >= 2) return "B";
  return null;
}
function checkSetWin(games) {
  const { A, B } = games;
  if (A >= 6 && A - B >= 2) return "A";
  if (B >= 6 && B - A >= 2) return "B";
  if (A === 7 && B === 6) return "A";
  if (B === 7 && A === 6) return "B";
  return null;
}
function setsWonCount(sets, team) {
  return sets.filter((s) => s.winner === team).length;
}
export function addPoint(state, team) {
  if (state.matchWinner) return state;
  let s = cloneState(state);
  s.setWinner = null;

  if (s.tiebreak) {
    s.tiebreak[team] += 1;
    const tbWinner = checkTiebreakWin(s);
    if (tbWinner) {
      s.games[tbWinner] += 1;
      s.sets.push({ A: s.games.A, B: s.games.B, winner: tbWinner, tiebreak: { ...s.tiebreak } });
      s.games = { A: 0, B: 0 };
      s.tiebreak = null;
      s.points = { A: 0, B: 0 };
      s.setWinner = tbWinner;
      if (setsWonCount(s.sets, tbWinner) >= 2) s.matchWinner = tbWinner;
      s.server = other(s.server);
    }
    return s;
  }

  s.points[team] += 1;
  const gameWinner = checkGameWin(s);
  if (gameWinner) {
    s.games[gameWinner] += 1;
    s.points = { A: 0, B: 0 };
    s.server = other(s.server);

    if (s.games.A === 6 && s.games.B === 6) {
      s.tiebreak = { A: 0, B: 0 };
    } else {
      const setW = checkSetWin(s.games);
      if (setW) {
        s.sets.push({ A: s.games.A, B: s.games.B, winner: setW });
        s.games = { A: 0, B: 0 };
        s.setWinner = setW;
        if (setsWonCount(s.sets, setW) >= 2) s.matchWinner = setW;
      }
    }
  }
  return s;
}

/* ============================== AMERICANO ENGINE ============================== */
function combinations(arr, k) {
  const results = [];
  function helper(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combo.push(arr[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }
  helper(0, []);
  return results;
}
function pairKey(a, b) {
  return [a, b].sort().join("-");
}
function splitsOfFour(four) {
  const [a, b, c, d] = four;
  return [
    { teamA: [a, b], teamB: [c, d] },
    { teamA: [a, c], teamB: [b, d] },
    { teamA: [a, d], teamB: [b, c] },
  ];
}

/**
 * Generate the next batch of Americano rounds, continuing from existing history so that
 * "add more rounds" keeps partner-fairness/sit-out-fairness continuity instead of resetting.
 * existingRounds: rounds already generated/played (used to seed partner/sitout counts)
 * count: how many additional rounds to generate (only used for the "extra" continuation
 *        pass once every pair has partnered at least once; for the initial call this is
 *        ignored and a full fair rotation is generated instead).
 */
export function generateAmericanoSchedule(players, existingRounds = [], extraCount = 0) {
  const n = players.length;
  if (n < 4 || n > 8) throw new Error("Americano supports 4-8 players");

  if (n === 4 && existingRounds.length === 0 && extraCount === 0) {
    const splits = splitsOfFour(players);
    return splits.map((s) => ({
      court: [...s.teamA, ...s.teamB],
      teamA: s.teamA,
      teamB: s.teamB,
      sitOut: [],
      scoreA: null,
      scoreB: null,
    }));
  }

  const partnerCount = {};
  const sitOutCount = {};
  players.forEach((p) => (sitOutCount[p] = 0));
  const allPairs = combinations(players, 2);
  allPairs.forEach((pair) => (partnerCount[pairKey(pair[0], pair[1])] = 0));

  // seed counts from existing rounds so continuation stays fair
  existingRounds.forEach((r) => {
    if (partnerCount[pairKey(r.teamA[0], r.teamA[1])] != null) {
      partnerCount[pairKey(r.teamA[0], r.teamA[1])] += 1;
    }
    if (partnerCount[pairKey(r.teamB[0], r.teamB[1])] != null) {
      partnerCount[pairKey(r.teamB[0], r.teamB[1])] += 1;
    }
    (r.sitOut || []).forEach((p) => {
      if (sitOutCount[p] != null) sitOutCount[p] += 1;
    });
  });

  const totalPairs = allPairs.length;
  const numSitOut = n - 4;
  const newRounds = [];

  // Determine how many rounds to generate this call:
  // - if this is the initial generation (existingRounds empty), generate until every pair
  //   has partnered at least once.
  // - if extending (existingRounds non-empty or extraCount>0), generate exactly extraCount
  //   more rounds (defaulting to a full extra rotation's worth if extraCount not given).
  const isInitial = existingRounds.length === 0;
  const targetExtra = extraCount > 0 ? extraCount : isInitial ? Infinity : totalPairs;
  const maxIterations = totalPairs * 3 + targetExtra + 10;

  for (let r = 0; r < maxIterations && newRounds.length < targetExtra; r++) {
    if (isInitial) {
      const allPartnered = allPairs.every((p) => partnerCount[pairKey(p[0], p[1])] > 0);
      if (allPartnered) break;
    }

    const sortedBySitOut = [...players].sort((a, b) => sitOutCount[a] - sitOutCount[b]);
    const poolSize = Math.min(players.length, numSitOut + 3);
    const pool = numSitOut > 0 ? sortedBySitOut.slice(0, poolSize) : [];
    const sitOutOptions = numSitOut > 0 ? combinations(pool, numSitOut) : [[]];

    let best = null;
    for (const sitOutGroup of sitOutOptions) {
      const onCourt = players.filter((p) => !sitOutGroup.includes(p));
      if (onCourt.length !== 4) continue;
      for (const combo of combinations(onCourt, 2)) {
        const teamA = combo;
        const teamB = onCourt.filter((p) => !teamA.includes(p));
        if (teamB.length !== 2) continue;
        const score =
          partnerCount[pairKey(teamA[0], teamA[1])] + partnerCount[pairKey(teamB[0], teamB[1])];
        const fairness = sitOutGroup.reduce((acc, p) => acc + sitOutCount[p], 0);
        if (!best || score < best.score || (score === best.score && fairness < best.fairness)) {
          best = { sitOutGroup, teamA, teamB, score, fairness };
        }
      }
    }

    partnerCount[pairKey(best.teamA[0], best.teamA[1])] += 1;
    partnerCount[pairKey(best.teamB[0], best.teamB[1])] += 1;
    best.sitOutGroup.forEach((p) => (sitOutCount[p] += 1));

    newRounds.push({
      court: [...best.teamA, ...best.teamB],
      teamA: best.teamA,
      teamB: best.teamB,
      sitOut: best.sitOutGroup,
      scoreA: null,
      scoreB: null,
    });
  }

  return newRounds;
}

export function computeLeaderboard(players, rounds) {
  const board = {};
  players.forEach((p) => (board[p] = { player: p, points: 0, played: 0, wins: 0 }));
  rounds.forEach((r) => {
    if (r.scoreA == null || r.scoreB == null) return;
    r.teamA.forEach((p) => {
      if (!board[p]) return;
      board[p].points += r.scoreA;
      board[p].played += 1;
      if (r.scoreA > r.scoreB) board[p].wins += 1;
    });
    r.teamB.forEach((p) => {
      if (!board[p]) return;
      board[p].points += r.scoreB;
      board[p].played += 1;
      if (r.scoreB > r.scoreA) board[p].wins += 1;
    });
  });
  return Object.values(board).sort((a, b) => b.points - a.points || b.wins - a.wins);
}
