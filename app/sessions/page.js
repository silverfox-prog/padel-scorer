"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Eye, Pencil, CheckCircle2 } from "lucide-react";
import { COURT_GREEN, LINE, CLAY } from "../../lib/ui";
import { getSessionHistory } from "../../lib/dataStore";
import { supabase, supabaseEnabled } from "../../lib/supabaseClient";
import { requireUnlock } from "../../lib/auth";

export default function SessionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!supabaseEnabled) {
      setError("Supabase not configured");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await getSessionHistory(100);
        setSessions(data);
      } catch (e) {
        setError(e.message || "Failed to load sessions");
      }
      setLoading(false);
    })();
  }, []);

  async function handleDelete(sessionId) {
    if (!requireUnlock()) return;
    if (!confirm("Delete this session?")) return;
    try {
      const { error: deleteError } = await supabase.from("sessions").delete().eq("id", sessionId);
      if (deleteError) throw deleteError;

      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (e) {
      alert("Failed to delete: " + e.message);
    }
  }

  async function handleRename(session) {
    if (!requireUnlock()) return;
    const input = prompt("Session name:", session.label || "");
    if (input === null) return; // cancelled
    const newLabel = input.trim() || null;
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ label: newLabel })
        .eq("id", session.id);
      if (updateError) throw updateError;

      setSessions(sessions.map((s) => (s.id === session.id ? { ...s, label: newLabel } : s)));
    } catch (e) {
      alert("Failed to rename: " + e.message);
    }
  }

  async function handleFinish(session) {
    if (!requireUnlock()) return;
    if (!confirm("Mark this session as finished? Any unplayed rounds will be left as-is.")) return;
    try {
      const { error: updateError } = await supabase
        .from("sessions")
        .update({ status: "final" })
        .eq("id", session.id);
      if (updateError) throw updateError;

      setSessions(sessions.map((s) => (s.id === session.id ? { ...s, status: "final" } : s)));
    } catch (e) {
      alert("Failed to finish session: " + e.message);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: COURT_GREEN, color: LINE, fontFamily: "system-ui, sans-serif", padding: "20px 16px 40px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: LINE, cursor: "pointer", display: "flex" }}
          >
            <ArrowLeft size={20} />
          </button>
          <h1 style={{ fontFamily: "'Georgia', serif", fontSize: 24, margin: 0 }}>Sessions</h1>
        </div>

        {loading && <div style={{ textAlign: "center", opacity: 0.7 }}>Loading…</div>}
        {error && <div style={{ color: "#ffb4a8", textAlign: "center", fontWeight: 600 }}>{error}</div>}

        {!loading && sessions.length === 0 && (
          <div style={{ textAlign: "center", opacity: 0.7, fontSize: 13.5, padding: 20 }}>
            No sessions yet.
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
            {sessions.map((session, i) => (
              <div
                key={session.id}
                style={{
                  padding: "12px 16px",
                  borderBottom: i < sessions.length - 1 ? "1px solid rgba(244,239,230,0.1)" : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  justifyContent: "space-between",
                }}
              >
                <button
                  onClick={() => router.push(`/session/${session.id}`)}
                  style={{
                    flex: 1,
                    background: "none",
                    border: "none",
                    color: LINE,
                    textAlign: "left",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 4 }}>
                    {session.played_on}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: session.label ? "none" : "capitalize" }}>
                    {session.label ? session.label : session.mode}
                  </div>
                  {session.label && (
                    <div style={{ fontSize: 11, opacity: 0.55, marginTop: 2, textTransform: "capitalize" }}>
                      {session.mode}
                    </div>
                  )}
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2, textTransform: "uppercase" }}>
                    {session.status}
                  </div>
                </button>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => handleRename(session)}
                    style={{
                      background: "none",
                      border: "none",
                      color: CLAY,
                      cursor: "pointer",
                      padding: 8,
                      display: "flex",
                    }}
                    title="Rename session"
                  >
                    <Pencil size={18} />
                  </button>
                  {session.status !== "final" && (
                    <button
                      onClick={() => handleFinish(session)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#8fd4a8",
                        cursor: "pointer",
                        padding: 8,
                        display: "flex",
                      }}
                      title="Mark as finished"
                    >
                      <CheckCircle2 size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/session/${session.id}`)}
                    style={{
                      background: "none",
                      border: "none",
                      color: CLAY,
                      cursor: "pointer",
                      padding: 8,
                      display: "flex",
                    }}
                    title="View session"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(session.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ffb4a8",
                      cursor: "pointer",
                      padding: 8,
                      display: "flex",
                    }}
                    title="Delete session"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
