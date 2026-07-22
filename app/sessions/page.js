"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Eye } from "lucide-react";
import { COURT_GREEN, LINE, CLAY } from "../../lib/ui";
import { getSessionHistory, deleteSession } from "../../lib/dataStore";
import { supabaseEnabled } from "../../lib/supabaseClient";

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
  if (!confirm("Delete this session? This cannot be undone.")) return;
  try {
    console.log("Deleting session:", sessionId);
    await deleteSession(sessionId);
    console.log("Delete succeeded");
    setSessions(sessions.filter((s) => s.id !== sessionId));
    setTimeout(() => window.location.reload(), 500);
  } catch (e) {
    console.error("Delete error:", e);
    alert("Failed to delete: " + e.message);
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
            No sessions yet. Start a match to create one.
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
                  <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize" }}>
                    {session.mode}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2, textTransform: "uppercase" }}>
                    {session.status}
                  </div>
                </button>

                <div style={{ display: "flex", gap: 8 }}>
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
