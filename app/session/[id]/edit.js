"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { COURT_GREEN, LINE, CLAY } from "../../../lib/ui";
import {
  getSessionRoundsWithNames,
  deleteRound,
  updateRound,
  deleteSession,
} from "../../../lib/dataStore";
import { supabase, supabaseEnabled } from "../../../lib/supabaseClient";

export default function SessionEditPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id;

  const [session, setSession] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingRound, setEditingRound] = useState(null);

  useEffect(() => {
    if (!supabaseEnabled) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data: sess, error: sessErr } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sessionId)
          .single();

        if (sessErr) throw sessErr;

        setSession(sess);

        const roundsData = await getSessionRoundsWithNames(sessionId);
        setRounds(roundsData);
      } catch (e) {
        setError(e.message || "Failed to load session");
      }
      setLoading(false);
    })();
  }, [sessionId]);

  async function handleDeleteRound(roundId) {
    if (!confirm("Delete this round?")) return;
    try {
      await deleteRound(roundId);
      setRounds(rounds.filter((r) => r.id !== roundId));
    } catch (e) {
      alert("Failed to delete round: " + e.message);
    }
  }

  async function handleDeleteSession() {
    if (!confirm("Delete entire session? This cannot be undone.")) return;
    try {
      await deleteSession(sessionId);
      router.push("/stats");
    } catch (e) {
      alert("Failed to delete session: " + e.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: COURT_GREEN, color: LINE, fontFamily: "system-ui, sans-serif", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => router.back()}
            style={{ background: "none", border: "none", color: LINE, cursor: "pointer", display: "flex" }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 24, margin: 0 }}>Edit Session</h1>
        </div>

        {loading && <div style={{ textAlign: "center", opacity: 0.7 }}>Loading…</div>}
        {error && <div style={{ color: "#ffb4a8", textAlign: "center", fontWeight: 600 }}>{error}</div>}

        {!loading && session && (
          <>
            <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Played on {session.played_on}</div>
              <div style={{ fontSize: 18, fontWeight: 700, textTransform: "capitalize", marginBottom: 12 }}>
                {session.mode}
              </div>
              <button
                onClick={handleDeleteSession}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#ffb4a8",
                  color: "#000",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <Trash2 size={16} /> Delete entire session
              </button>
            </div>

            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Rounds</h2>
            <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
              {rounds.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", opacity: 0.7 }}>No rounds.</div>
              ) : (
                rounds.map((round, i) => (
                  <div
                    key={round.id}
                    style={{
                      padding: "12px 16px",
                      borderBottom: i < rounds.length - 1 ? "1px solid rgba(244,239,230,0.1)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                          Round {round.round_number + 1}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                          {round.team_a_names.join(" & ")} vs {round.team_b_names.join(" & ")}
                        </div>
                        {round.score_a != null && (
                          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                            {round.score_a} – {round.score_b}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteRound(round.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#ffb4a8",
                          cursor: "pointer",
                          padding: 8,
                          display: "flex",
                        }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
