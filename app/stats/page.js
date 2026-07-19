"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { COURT_GREEN, LINE, CLAY } from "../../lib/ui";
import { getAllPlayerStats, getPartnerStats, getHeadToHeadStats, getSessionHistory } from "../../lib/dataStore";
import { supabaseEnabled } from "../../lib/supabaseClient";

export default function StatsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playerStats, setPlayerStats] = useState([]);
  const [partnerStats, setPartnerStats] = useState([]);
  const [h2hStats, setH2hStats] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState("leaderboard");

  useEffect(() => {
    if (!supabaseEnabled) {
      setError("Supabase isn't configured.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const [ps, pairs, h2h, hist] = await Promise.all([
          getAllPlayerStats(),
          getPartnerStats(),
          getHeadToHeadStats(),
          getSessionHistory(),
        ]);
        setPlayerStats(ps);
        setPartnerStats(pairs.sort((a, b) => b.games_together - a.games_together));
        setH2hStats(h2h.sort((a, b) => b.matches_played - a.matches_played));
        setHistory(hist);
      } catch (e) {
        setError(e.message || "Failed to load stats");
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: COURT_GREEN, color: LINE, fontFamily: "system-ui, sans-serif", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: LINE, cursor: "pointer", display: "flex" }}>
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 24, margin: 0 }}>Stats</h1>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {[
            ["leaderboard", "Leaderboard"],
            ["partners", "Partners"],
            ["h2h", "Head-to-head"],
            ["history", "Session history"],
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

        {loading && <div style={{ textAlign: "center", opacity: 0.7 }}>Loading…</div>}
        {error && <div style={{ color: "#ffb4a8", textAlign: "center", fontWeight: 600 }}>{error}</div>}

        {!loading && !error && tab === "leaderboard" && (
          <StatTable
            columns={["Player", "Played", "Wins", "Win %", "Points"]}
            rows={playerStats.map((p) => [
              p.name,
              p.games_played,
              p.wins,
              p.games_played ? `${Math.round((p.wins / p.games_played) * 100)}%` : "–",
              p.total_points,
            ])}
            emptyMessage="No games recorded yet."
          />
        )}

        {!loading && !error && tab === "partners" && (
          <StatTable
            columns={["Pair", "Games together", "Wins together"]}
            rows={partnerStats.map((p) => [`${p.player_1_name} & ${p.player_2_name}`, p.games_together, p.wins_together])}
            emptyMessage="No partner data yet — play an Americano tournament."
          />
        )}

        {!loading && !error && tab === "h2h" && (
          <StatTable
            columns={["Matchup", "Played", `P1 wins`]}
            rows={h2hStats.map((h) => [`${h.player_1_name} vs ${h.player_2_name}`, h.matches_played, h.player_1_wins])}
            emptyMessage="No head-to-head data yet."
          />
        )}

        {!loading && !error && tab === "history" && (
          <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
            {history.length === 0 && <div style={{ padding: 16, textAlign: "center", opacity: 0.7, fontSize: 13.5 }}>No sessions yet.</div>}
            {history.map((s, i) => (
              <button
                key={s.id}
                onClick={() => router.push(`/session/${s.id}`)}
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
                <div style={{ fontSize: 13, opacity: 0.75, minWidth: 90 }}>{s.played_on}</div>
                <div style={{ flex: 1, fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>{s.mode}</div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 6,
                    background: s.status === "final" ? CLAY : "rgba(244,239,230,0.15)",
                    textTransform: "uppercase",
                  }}
                >
                  {s.status}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatTable({ columns, rows, emptyMessage }) {
  if (rows.length === 0) {
    return <div style={{ textAlign: "center", opacity: 0.7, fontSize: 13.5, padding: 20 }}>{emptyMessage}</div>;
  }
  return (
    <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `2fr repeat(${columns.length - 1}, 1fr)`, padding: "10px 14px", fontSize: 11, opacity: 0.65, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {columns.map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: `2fr repeat(${columns.length - 1}, 1fr)`,
            padding: "10px 14px",
            fontSize: 13.5,
            borderTop: "1px solid rgba(244,239,230,0.08)",
          }}
        >
          {row.map((cell, j) => (
            <div key={j} style={{ fontWeight: j === 0 ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
