"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { COURT_GREEN, LINE, CLAY } from "../../../lib/ui";
import { getPlayerHistory, getPlayerStats, getHeadToHeadStats, getPartnerStats } from "../../../lib/dataStore";
import { supabaseEnabled } from "../../../lib/supabaseClient";

export default function PlayerProfilePage() {
  const params = useParams();
  const router = useRouter();
  const playerName = decodeURIComponent(params.name);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [partners, setPartners] = useState([]);
  const [opponents, setOpponents] = useState([]);
  const [tab, setTab] = useState("stats");

  useEffect(() => {
    if (!supabaseEnabled) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const [playerStats, playerHistory, allPartners, allH2h] = await Promise.all([
          getPlayerStats(playerName),
          getPlayerHistory(playerName),
          getPartnerStats(),
          getHeadToHeadStats(),
        ]);

        setStats(playerStats);
        setHistory(playerHistory.rounds || []);

        // Filter partner/h2h to only those involving this player
        setPartners(
          allPartners.filter(
            (p) => p.player_1_name === playerName || p.player_2_name === playerName
          )
        );
        setOpponents(
          allH2h.filter(
            (p) => p.player_1_name === playerName || p.player_2_name === playerName
          )
        );
      } catch (e) {
        setError(e.message || "Failed to load player data");
      }
      setLoading(false);
    })();
  }, [playerName]);

  return (
    <div style={{ minHeight: "100vh", background: COURT_GREEN, color: LINE, fontFamily: "system-ui, sans-serif", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => router.push("/stats")}
            style={{ background: "none", border: "none", color: LINE, cursor: "pointer", display: "flex" }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 24, margin: 0 }}>{playerName}</h1>
        </div>

        {loading && <div style={{ textAlign: "center", opacity: 0.7 }}>Loading…</div>}
        {error && <div style={{ color: "#ffb4a8", textAlign: "center", fontWeight: 600 }}>{error}</div>}

        {!loading && stats && (
          <>
            <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <StatBox label="Games" value={stats.games_played} />
                <StatBox label="Wins" value={stats.wins} />
                <StatBox label="Win %" value={`${stats.games_played ? Math.round((stats.wins / stats.games_played) * 100) : 0}%`} />
                <StatBox label="Points" value={stats.total_points} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              {[
                ["stats", "Lifetime"],
                ["partners", "Partners"],
                ["opponents", "Opponents"],
                ["history", "History"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "none",
                    background: tab === key ? CLAY : "rgba(244,239,230,0.1)",
                    color: LINE,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "partners" && (
              <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
                {partners.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", opacity: 0.7, fontSize: 13.5 }}>
                    No partner data yet.
                  </div>
                ) : (
                  partners.map((p, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "12px 16px",
                        borderBottom: i < partners.length - 1 ? "1px solid rgba(244,239,230,0.1)" : "none",
                      }}
                    >
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        {p.player_1_name === playerName ? p.player_2_name : p.player_1_name}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                        {p.wins_together}–{p.games_together - p.wins_together} ({p.games_together} games)
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === "opponents" && (
              <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
                {opponents.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", opacity: 0.7, fontSize: 13.5 }}>
                    No head-to-head data yet.
                  </div>
                ) : (
                  opponents.map((h, i) => {
                    const theirName =
                      h.player_1_name === playerName ? h.player_2_name : h.player_1_name;
                    const playerWins = h.player_1_name === playerName ? h.player_1_wins : h.matches_played - h.player_1_wins;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "12px 16px",
                          borderBottom: i < opponents.length - 1 ? "1px solid rgba(244,239,230,0.1)" : "none",
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>{theirName}</div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                          {playerWins}–{h.matches_played - playerWins} ({h.matches_played} matches)
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {tab === "history" && (
              <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
                {history.length === 0 ? (
                  <div style={{ padding: 16, textAlign: "center", opacity: 0.7, fontSize: 13.5 }}>
                    No games yet.
                  </div>
                ) : (
                  history.map((round, i) => (
                    <button
                      key={round.id}
                      onClick={() => router.push(`/session/${round.sessions.id}`)}
                      style={{
                        display: "flex",
                        width: "100%",
                        alignItems: "center",
                        gap: 12,
                        padding: "12px 16px",
                        background: "none",
                        border: "none",
                        color: LINE,
                        textAlign: "left",
                        cursor: "pointer",
                        borderBottom: i < history.length - 1 ? "1px solid rgba(244,239,230,0.1)" : "none",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>
                          {round.sessions.played_on}
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, textTransform: "capitalize" }}>
                          {round.sessions.mode}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        {round.score_a} – {round.score_b}
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 11, opacity: 0.6, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}
