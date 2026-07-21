"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Trophy, ChevronRight, BarChart3 } from "lucide-react";
import { COURT_GREEN, CLAY, LINE, labelStyle, inputStyle } from "../lib/ui";
import { supabaseEnabled } from "../lib/supabaseClient";
import { createSession } from "../lib/dataStore";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function Home() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [playedOn, setPlayedOn] = useState(todayIso());

  async function handleCreate(mode) {
    setCreating(true);
    setError("");

    if (!supabaseEnabled) {
      setError("Supabase isn't configured yet — add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setCreating(false);
      return;
    }

    try {
      const config = mode === "classic" ? { goldenPoint: true, teamNames: { A: "Team A", B: "Team B" } } : {};
      const scoringState =
        mode === "classic"
          ? { server: "A", points: { A: 0, B: 0 }, games: { A: 0, B: 0 }, sets: [], tiebreak: null, matchWinner: null, needsSetup: true }
          : { stage: "setup", players: [], rounds: [], scoringMode: "fixed", target: 21 };

      const session = await createSession({ mode, config, playedOn, scoringState });
      router.push(`/session/${session.id}`);
    } catch (e) {
      setError(e.message || "Failed to create session");
      setCreating(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COURT_GREEN,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 400, width: "100%" }}>
        <h1
          style={{
            color: LINE,
            fontFamily: "'Georgia', serif",
            fontSize: 30,
            textAlign: "center",
            marginBottom: 6,
            letterSpacing: -0.5,
          }}
        >
          Padel Scorer
        </h1>
        <p style={{ color: "rgba(244,239,230,0.7)", textAlign: "center", marginBottom: 20, fontSize: 14 }}>
          Choose how you're playing
        </p>

        <div style={{ background: LINE, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
          <span style={labelStyle}>Date played</span>
          <input
            type="date"
            value={playedOn}
            onChange={(e) => setPlayedOn(e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>

        <ModeCard
          icon={<Trophy size={22} />}
          title="Classic Match"
          desc="Two teams, standard sets & games, optional golden point"
          onClick={() => handleCreate("classic")}
          disabled={creating}
        />
        <div style={{ height: 14 }} />
        <ModeCard
          icon={<Users size={22} />}
          title="Americano"
          desc="4-8 players rotate partners each round, individual leaderboard"
          onClick={() => handleCreate("americano")}
          disabled={creating}
        />
        <div style={{ height: 14 }} />
        <ModeCard
          icon={<BarChart3 size={22} />}
          title="Stats"
          desc="Lifetime leaderboard, partner and head-to-head records"
          onClick={() => router.push("/stats")}
          disabled={creating}
        />

        {error && (
          <div style={{ color: "#ffb4a8", fontSize: 13, marginTop: 16, textAlign: "center", fontWeight: 600 }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function ModeCard({ icon, title, desc, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        background: LINE,
        border: "none",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        alignItems: "center",
        gap: 16,
        cursor: disabled ? "default" : "pointer",
        textAlign: "left",
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <div
        style={{
          background: CLAY,
          color: LINE,
          borderRadius: 10,
          width: 44,
          height: 44,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: COURT_GREEN }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "#6b7a72", marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
      </div>
      <ChevronRight size={20} color={COURT_GREEN} style={{ opacity: 0.5, flexShrink: 0 }} />
    </button>
  );
}
