"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { RotateCcw, Undo2, Settings2, Share2, Plus } from "lucide-react";
import {
  COURT_GREEN,
  CLAY,
  LINE,
  iconBtnStyle,
  labelStyle,
  inputStyle,
  primaryBtnStyle,
  secondaryBtnStyle,
  raceBtnStyle,
  backLinkStyle,
  Leaderboard,
  ToggleBtn,
} from "../../../lib/ui";
import {
  initClassicState,
  addPoint,
  pointName,
  generateAmericanoSchedule,
  computeLeaderboard,
} from "../../../lib/padelLogic";
import { supabase, supabaseEnabled } from "../../../lib/supabaseClient";
import { saveRoundResult } from "../../../lib/dataStore";

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);
  const savingRef = useRef(false);

  // Initial load
  useEffect(() => {
    if (!supabaseEnabled) {
      setLoadError("Supabase isn't configured. Add env vars and redeploy.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).single();
      if (cancelled) return;
      if (error) {
        setLoadError("Couldn't find this session. The link may be invalid.");
      } else {
        setSession(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Realtime subscription
  useEffect(() => {
    if (!supabaseEnabled || !sessionId) return;
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          // Avoid clobbering our own in-flight optimistic update
          if (savingRef.current) return;
          setSession(payload.new);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const persist = useCallback(
    async (updates) => {
      savingRef.current = true;
      setSession((prev) => ({ ...prev, ...updates }));
      const { error } = await supabase.from("sessions").update(updates).eq("id", sessionId);
      savingRef.current = false;
      if (error) console.error("Save failed:", error.message);
    },
    [sessionId]
  );

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }
  if (loadError) {
    return <CenteredMessage>{loadError}</CenteredMessage>;
  }
  if (!session) {
    return <CenteredMessage>Session not found.</CenteredMessage>;
  }

  const ShareBar = (
    <button onClick={copyLink} style={{ ...iconBtnStyle, gap: 6, width: "auto", padding: "8px 12px" }}>
      <Share2 size={16} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{copied ? "Copied!" : "Share"}</span>
    </button>
  );

  if (session.mode === "classic") {
    return <ClassicScorer session={session} persist={persist} shareBar={ShareBar} />;
  }
  return <AmericanoScorer session={session} persist={persist} shareBar={ShareBar} />;
}

function CenteredMessage({ children }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: COURT_GREEN,
        color: LINE,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

/* ============================== CLASSIC ============================== */
function ClassicScorer({ session, persist, shareBar }) {
  const state = session.scoring_state;
  const config = session.config || {};
  const [showSettings, setShowSettings] = useState(!!state.needsSetup);
  const [teamAInput, setTeamAInput] = useState(state.teamNames?.A || "Team A");
  const [teamBInput, setTeamBInput] = useState(state.teamNames?.B || "Team B");
  const [goldenPoint, setGoldenPoint] = useState(state.goldenPoint);

  function handlePoint(team) {
    const next = addPoint(state, team);
    const wasUnfinished = !state.matchWinner;
    persist({ scoring_state: next, status: next.matchWinner ? "final" : "active" });

    if (wasUnfinished && next.matchWinner) {
      const teamNamesNow = next.teamNames || { A: "Team A", B: "Team B" };
      const setsWonA = next.sets.filter((s) => s.winner === "A").length;
      const setsWonB = next.sets.filter((s) => s.winner === "B").length;
      saveRoundResult({
        sessionId: session.id,
        roundNumber: 0,
        teamANames: [teamNamesNow.A],
        teamBNames: [teamNamesNow.B],
        scoreA: setsWonA,
        scoreB: setsWonB,
      }).catch((e) => console.error("Failed to save match result:", e.message));
    }
  }
  function handleUndo() {
    // Undo isn't trivial with server-synced state (no history stored); offer reset-of-point-only
    // fallback: not implemented server-side history, so disable if nothing to undo.
  }
  function handleReset() {
    const next = initClassicState({ goldenPoint: state.goldenPoint, teamNames: state.teamNames });
    persist({ scoring_state: next, status: "active" });
  }
  function startMatch() {
    const next = initClassicState({ goldenPoint, teamNames: { A: teamAInput || "Team A", B: teamBInput || "Team B" } });
    persist({ scoring_state: next, config: { goldenPoint, teamNames: next.teamNames }, status: "active" });
    setShowSettings(false);
  }

  const teamNames = state.teamNames || { A: "Team A", B: "Team B" };
  const isDeuce =
    !state.tiebreak && state.points.A >= 3 && state.points.B >= 3 && state.points.A === state.points.B;

  if (showSettings) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: COURT_GREEN,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Georgia', serif",
          padding: 24,
        }}
      >
        <div style={{ background: LINE, borderRadius: 16, padding: 32, maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <h1 style={{ color: COURT_GREEN, fontSize: 28, margin: "0 0 4px", letterSpacing: -0.5 }}>Classic Match</h1>
          <p style={{ color: "#6b7a72", fontSize: 14, margin: "0 0 24px", fontFamily: "system-ui" }}>Set up your match</p>

          <label style={{ display: "block", marginBottom: 14, fontFamily: "system-ui" }}>
            <span style={labelStyle}>Team A</span>
            <input value={teamAInput} onChange={(e) => setTeamAInput(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "block", marginBottom: 20, fontFamily: "system-ui" }}>
            <span style={labelStyle}>Team B</span>
            <input value={teamBInput} onChange={(e) => setTeamBInput(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, fontFamily: "system-ui", cursor: "pointer" }}>
            <span>
              <span style={{ display: "block", fontSize: 15, color: COURT_GREEN, fontWeight: 600 }}>Golden point</span>
              <span style={{ display: "block", fontSize: 12, color: "#6b7a72" }}>Sudden death at 40-40 (no advantage)</span>
            </span>
            <input type="checkbox" checked={goldenPoint} onChange={(e) => setGoldenPoint(e.target.checked)} style={{ width: 22, height: 22, accentColor: CLAY }} />
          </label>

          <button onClick={startMatch} style={primaryBtnStyle}>
            Start Match
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COURT_GREEN, fontFamily: "system-ui, sans-serif", color: LINE, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 32px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <button onClick={() => setShowSettings(true)} style={iconBtnStyle} aria-label="Match settings">
            <Settings2 size={18} />
          </button>
          <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: 1, textTransform: "uppercase" }}>
            {state.goldenPoint ? "Golden Point" : "Advantage"}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {shareBar}
            <button onClick={handleReset} style={iconBtnStyle} aria-label="Reset match">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>

        {state.matchWinner && (
          <div style={{ background: CLAY, borderRadius: 12, padding: "14px 18px", textAlign: "center", marginBottom: 16, fontSize: 18, fontWeight: 700 }}>
            🏆 {teamNames[state.matchWinner]} wins the match!
          </div>
        )}

        <SetsTable state={state} teamNames={teamNames} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
          <TeamCard team="A" teamNames={teamNames} state={state} pointName={pointName(state, "A")} isDeuce={isDeuce} onPoint={() => handlePoint("A")} disabled={!!state.matchWinner} />
          <TeamCard team="B" teamNames={teamNames} state={state} pointName={pointName(state, "B")} isDeuce={isDeuce} onPoint={() => handlePoint("B")} disabled={!!state.matchWinner} />
        </div>

        {state.tiebreak && !state.matchWinner && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, opacity: 0.8, letterSpacing: 0.5 }}>TIE-BREAK</div>
        )}

        <p style={{ textAlign: "center", fontSize: 11.5, opacity: 0.5, marginTop: 24 }}>
          Anyone with this link can view and score this match live.
        </p>
      </div>
    </div>
  );
}

function SetsTable({ state, teamNames }) {
  const setCols = [...state.sets.map((s) => s), { A: state.games.A, B: state.games.B, inProgress: true }];
  return (
    <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
      {["A", "B"].map((team) => (
        <div key={team} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{teamNames[team]}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {setCols.map((col, i) => (
              <div
                key={i}
                style={{
                  width: 28,
                  height: 28,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: col.inProgress ? 700 : 500,
                  background: col.inProgress ? "rgba(244,239,230,0.15)" : col.winner === team ? CLAY : "rgba(244,239,230,0.06)",
                }}
              >
                {col[team]}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TeamCard({ team, teamNames, state, pointName, isDeuce, onPoint, disabled }) {
  const isServer = state.server === team && !state.matchWinner;
  return (
    <button
      onClick={onPoint}
      disabled={disabled}
      style={{
        background: "rgba(244,239,230,0.08)",
        border: isServer ? `2px solid ${CLAY}` : "2px solid transparent",
        borderRadius: 16,
        padding: "20px 12px",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600 }}>
        {isServer && <span style={{ width: 8, height: 8, borderRadius: "50%", background: CLAY, display: "inline-block" }} />}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{teamNames[team]}</span>
      </div>
      <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{pointName}</div>
      {isDeuce && !state.tiebreak && <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.5 }}>DEUCE</div>}
      <div style={{ fontSize: 12, opacity: 0.7 }}>Tap to score point</div>
    </button>
  );
}

/* ============================== AMERICANO ============================== */
function AmericanoScorer({ session, persist, shareBar }) {
  const state = session.scoring_state;
  const stage = state.stage || "setup";
  import { ScheduleView } from "../../../lib/scheduleView";

  const [numPlayers, setNumPlayers] = useState(state.players?.length || 4);
  const [playerInputs, setPlayerInputs] = useState(
    state.players?.length ? state.players : ["Player 1", "Player 2", "Player 3", "Player 4"]
  );
  const [scoringMode, setScoringMode] = useState(state.scoringMode || "fixed");
  const [target, setTarget] = useState(state.target || 21);
  const [currentRoundIdx, setCurrentRoundIdx] = useState(state.currentRoundIdx || 0);
  const [inputScoreA, setInputScoreA] = useState("");
  const [error, setError] = useState("");
  const [addRoundsCount, setAddRoundsCount] = useState(4);

  function updateNumPlayers(n) {
    setNumPlayers(n);
    setPlayerInputs((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(`Player ${next.length + 1}`);
      return next.slice(0, n);
    });
  }

  function startTournament() {
    const trimmed = playerInputs.map((p) => p.trim() || p);
    const hasDupes = new Set(trimmed).size !== trimmed.length;
    if (hasDupes) {
      setError("Player names must be unique.");
      return;
    }
    try {
      const schedule = generateAmericanoSchedule(trimmed);
      setError("");
      persist({
        scoring_state: {
          stage: "playing",
          players: trimmed,
          rounds: schedule,
          scoringMode,
          target,
          currentRoundIdx: 0,
        },
        config: { scoringMode, target },
        status: "active",
      });
      setCurrentRoundIdx(0);
    } catch (e) {
      setError(e.message);
    }
  }

  function submitFixedScore() {
    const val = parseInt(inputScoreA, 10);
    if (isNaN(val) || val < 0 || val > state.target) {
      setError(`Enter a score between 0 and ${state.target}`);
      return;
    }
    setError("");
    const rounds = [...state.rounds];
    rounds[currentRoundIdx] = { ...rounds[currentRoundIdx], scoreA: val, scoreB: state.target - val };
    advanceOrSave(rounds);
  }

  function addRacePointTo(team) {
    const r = state.rounds[currentRoundIdx];
    const scoreA = r.scoreA ?? 0;
    const scoreB = r.scoreB ?? 0;
    const nextA = team === "A" ? scoreA + 1 : scoreA;
    const nextB = team === "B" ? scoreB + 1 : scoreB;
    const rounds = [...state.rounds];
    rounds[currentRoundIdx] = { ...r, scoreA: nextA, scoreB: nextB };
    const complete = nextA >= state.target || nextB >= state.target;
    if (complete) {
      advanceOrSave(rounds);
    } else {
      persist({ scoring_state: { ...state, rounds } });
    }
  }

  function advanceOrSave(rounds) {
    const isLast = currentRoundIdx + 1 >= rounds.length;
    const nextIdx = isLast ? currentRoundIdx : currentRoundIdx + 1;
    const nextStage = isLast ? "final" : "playing";
    persist({
      scoring_state: { ...state, rounds, currentRoundIdx: nextIdx, stage: nextStage },
      status: isLast ? "final" : "active",
    });
    setCurrentRoundIdx(nextIdx);
    setInputScoreA("");

    const completedRound = rounds[currentRoundIdx];
    saveRoundResult({
      sessionId: session.id,
      roundNumber: currentRoundIdx,
      teamANames: completedRound.teamA,
      teamBNames: completedRound.teamB,
      sitOutNames: completedRound.sitOut || [],
      scoreA: completedRound.scoreA,
      scoreB: completedRound.scoreB,
    }).catch((e) => console.error("Failed to save round result:", e.message));
  }

  function goToRound(i) {
    setCurrentRoundIdx(i);
    setInputScoreA("");
    setError("");
    persist({ scoring_state: { ...state, currentRoundIdx: i, stage: "playing" }, status: "active" });
  }

  function addMoreRounds() {
    const more = generateAmericanoSchedule(state.players, state.rounds, addRoundsCount);
    const rounds = [...state.rounds, ...more];
    persist({
      scoring_state: { ...state, rounds, stage: "playing" },
      status: "active",
    });
  }

  function resetAll() {
    persist({
      scoring_state: { stage: "setup", players: [], rounds: [], scoringMode: "fixed", target: 21 },
      status: "active",
    });
  }

  if (stage === "setup") {
    return (
      <div style={{ minHeight: "100vh", background: COURT_GREEN, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ background: LINE, borderRadius: 16, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
          <h1 style={{ color: COURT_GREEN, fontSize: 26, margin: "0 0 4px", fontFamily: "'Georgia', serif" }}>Americano</h1>
          <p style={{ color: "#6b7a72", fontSize: 13.5, margin: "0 0 20px" }}>4-8 players, rotating partners</p>

          <div style={{ marginBottom: 18 }}>
            <span style={labelStyle}>Number of players</span>
            <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {[4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => updateNumPlayers(n)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: `2px solid ${numPlayers === n ? CLAY : "#e3ddd0"}`,
                    background: numPlayers === n ? CLAY : "transparent",
                    color: numPlayers === n ? LINE : COURT_GREEN,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={labelStyle}>Player names</span>
            {playerInputs.map((p, i) => (
              <input
                key={i}
                value={p}
                onChange={(e) => {
                  const next = [...playerInputs];
                  next[i] = e.target.value;
                  setPlayerInputs(next);
                }}
                style={inputStyle}
                placeholder={`Player ${i + 1}`}
              />
            ))}
          </div>

          <div style={{ marginBottom: 18 }}>
            <span style={labelStyle}>Scoring mode</span>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <ToggleBtn active={scoringMode === "fixed"} onClick={() => setScoringMode("fixed")} label="Fixed points/game" />
              <ToggleBtn active={scoringMode === "race"} onClick={() => setScoringMode("race")} label="Race to target" />
            </div>
            <p style={{ fontSize: 11.5, color: "#6b7a72", marginTop: 6, lineHeight: 1.4 }}>
              {scoringMode === "fixed"
                ? "Each game's points are split between teams to sum to the target (e.g. 13-8 of 21)."
                : "First team to reach the target points wins the game outright."}
            </p>
          </div>

          <div style={{ marginBottom: 22 }}>
            <span style={labelStyle}>Points target ({target})</span>
            <input type="range" min={8} max={40} step={1} value={target} onChange={(e) => setTarget(parseInt(e.target.value, 10))} style={{ width: "100%", marginTop: 8, accentColor: CLAY }} />
          </div>

          {error && <div style={{ color: "#b0433a", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{error}</div>}

          <button onClick={startTournament} style={primaryBtnStyle}>
            Generate Schedule & Start
          </button>
        </div>
      </div>
    );
  }

  const leaderboard = computeLeaderboard(state.players, state.rounds);

  if (stage === "final") {
    return (
      <div style={{ minHeight: "100vh", background: COURT_GREEN, color: LINE, fontFamily: "system-ui, sans-serif", padding: "24px 16px", display: "flex", justifyContent: "center" }}>
        <div style={{ maxWidth: 480, width: "100%" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>{shareBar}</div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 40 }}>🏆</div>
            <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 26, margin: "8px 0 4px" }}>Final Standings</h1>
            <p style={{ opacity: 0.7, fontSize: 13.5 }}>{state.rounds.length} rounds played</p>
          </div>
          <Leaderboard leaderboard={leaderboard} />

          <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 10 }}>Want to keep playing?</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="number"
                min={1}
                max={20}
                value={addRoundsCount}
                onChange={(e) => setAddRoundsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ ...inputStyle, marginTop: 0, width: 70, flex: "none" }}
              />
              <button onClick={addMoreRounds} style={{ ...primaryBtnStyle, width: "auto", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={16} /> Add rounds
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={resetAll} style={{ ...secondaryBtnStyle, flex: 1 }}>
              New Tournament
            </button>
          </div>
        </div>
      </div>
    );
  }

  const round = state.rounds[currentRoundIdx];
  const teamAName = round.teamA.join(" & ");
  const teamBName = round.teamB.join(" & ");

  return (
    <div style={{ minHeight: "100vh", background: COURT_GREEN, color: LINE, fontFamily: "system-ui, sans-serif", padding: "20px 16px 32px", display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: 1, textTransform: "uppercase" }}>
            Round {currentRoundIdx + 1} / {state.rounds.length}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {shareBar}
            <button onClick={resetAll} style={iconBtnStyle} aria-label="Reset">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", justifyContent: "center" }}>
          {state.rounds.map((r, i) => (
            <button
              key={i}
              onClick={() => goToRound(i)}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                border: "none",
                background: i === currentRoundIdx ? CLAY : r.scoreA != null ? "rgba(244,239,230,0.3)" : "rgba(244,239,230,0.1)",
                color: LINE,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 14, padding: 18, marginBottom: 16 }}>
          {round.sitOut.length > 0 && (
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10, textAlign: "center" }}>Sitting out: {round.sitOut.join(", ")}</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{teamAName}</div>
              <div style={{ fontSize: 40, fontWeight: 800 }}>{round.scoreA ?? 0}</div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.5 }}>vs</div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{teamBName}</div>
              <div style={{ fontSize: 40, fontWeight: 800 }}>{round.scoreB ?? 0}</div>
            </div>
          </div>
        </div>

        {round.scoreA != null && (
          <div style={{ textAlign: "center", fontSize: 13, opacity: 0.75, marginBottom: 12 }}>
            ✓ Round complete — tap a round number to review, or continue
          </div>
        )}

        {state.scoringMode === "fixed" ? (
          <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 12.5, opacity: 0.75, marginBottom: 8 }}>
              Enter {teamAName}'s score (0-{state.target}), the rest goes to {teamBName}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="number"
                min={0}
                max={state.target}
                value={inputScoreA}
                onChange={(e) => setInputScoreA(e.target.value)}
                placeholder="0"
                style={{ ...inputStyle, flex: 1, marginTop: 0 }}
              />
              <button onClick={submitFixedScore} style={{ ...primaryBtnStyle, width: "auto", padding: "0 20px" }}>
                Save
              </button>
            </div>
            {error && <div style={{ color: "#ffb4a8", fontSize: 12.5, marginTop: 8, fontWeight: 600 }}>{error}</div>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <button onClick={() => addRacePointTo("A")} style={raceBtnStyle}>
              +1 {teamAName}
            </button>
            <button onClick={() => addRacePointTo("B")} style={raceBtnStyle}>
              +1 {teamBName}
            </button>
          </div>
        )}

        {currentRoundIdx === state.rounds.length - 1 && round.scoreA != null && (
          <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, padding: 14, marginTop: 16 }}>
            <div style={{ fontSize: 12.5, opacity: 0.8, marginBottom: 8 }}>Last round done — add more?</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                type="number"
                min={1}
                max={20}
                value={addRoundsCount}
                onChange={(e) => setAddRoundsCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                style={{ ...inputStyle, marginTop: 0, width: 70, flex: "none" }}
              />
              <button onClick={addMoreRounds} style={{ ...secondaryBtnStyle, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={16} /> Add {addRoundsCount} round{addRoundsCount === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8, letterSpacing: 0.5 }}>LEADERBOARD</div>
          <Leaderboard leaderboard={leaderboard} compact />
        </div>

        <p style={{ textAlign: "center", fontSize: 11.5, opacity: 0.5, marginTop: 20 }}>
          Anyone with this link can view and score this tournament live.
        </p>
      </div>
    </div>
  );
}
