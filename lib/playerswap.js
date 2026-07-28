import { useState } from "react";
import { LINE, COURT_GREEN, CLAY, inputStyle, primaryBtnStyle, secondaryBtnStyle } from "./ui";

/**
 * A small modal for swapping one player's name within the CURRENT round only.
 *
 * Props:
 * - playerName: the name currently shown (what was tapped)
 * - allPlayers: array of all player names in the tournament (for a quick-pick list)
 * - onCancel: () => void
 * - onConfirm: (newName: string) => void   -- called with the replacement name
 */
export function PlayerSwapModal({ playerName, allPlayers, onCancel, onConfirm }) {
  const [customName, setCustomName] = useState("");

  const otherPlayers = allPlayers.filter((p) => p !== playerName);

  function handlePick(name) {
    if (!name || !name.trim()) return;
    onConfirm(name.trim());
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: LINE,
          borderRadius: 16,
          padding: 24,
          maxWidth: 360,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: COURT_GREEN, fontSize: 18, margin: "0 0 4px", fontFamily: "'Georgia', serif" }}>
          Swap {playerName}
        </h2>
        <p style={{ color: "#6b7a72", fontSize: 13, margin: "0 0 16px" }}>
          This round only — future rounds keep the original schedule.
        </p>

        {otherPlayers.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "#6b7a72", marginBottom: 8, fontWeight: 600 }}>
              Swap with someone already in the tournament:
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {otherPlayers.map((p) => (
                <button
                  key={p}
                  onClick={() => handlePick(p)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #e3ddd0",
                    background: "transparent",
                    color: COURT_GREEN,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "#6b7a72", marginBottom: 8, fontWeight: 600 }}>
            Or type a replacement (e.g. a sub who wasn't in the original lineup):
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Player name"
              style={{ ...inputStyle, marginTop: 0, flex: 1 }}
            />
            <button
              onClick={() => handlePick(customName)}
              style={{ ...primaryBtnStyle, width: "auto", padding: "0 16px" }}
            >
              Use
            </button>
          </div>
        </div>

        <button onClick={onCancel} style={secondaryBtnStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}
