export const COURT_GREEN = "#1B4B3A";
export const CLAY = "#C1662F";
export const LINE = "#F4EFE6";

export const iconBtnStyle = {
  background: "rgba(244,239,230,0.12)",
  border: "none",
  borderRadius: 8,
  padding: 8,
  color: LINE,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

export const labelStyle = {
  fontSize: 12,
  color: "#6b7a72",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  marginTop: 6,
  padding: "10px 12px",
  borderRadius: 8,
  border: `2px solid ${COURT_GREEN}22`,
  fontSize: 16,
  fontFamily: "system-ui",
  color: COURT_GREEN,
  background: LINE,
};

export const primaryBtnStyle = {
  width: "100%",
  padding: "14px",
  background: CLAY,
  color: LINE,
  border: "none",
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "system-ui",
  letterSpacing: 0.3,
};

export const secondaryBtnStyle = {
  padding: "12px",
  background: "rgba(244,239,230,0.12)",
  color: LINE,
  border: "none",
  borderRadius: 10,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

export const raceBtnStyle = {
  padding: "20px 12px",
  background: "rgba(244,239,230,0.1)",
  color: LINE,
  border: "none",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

export const backLinkStyle = {
  background: "none",
  border: "none",
  color: COURT_GREEN,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  padding: 0,
};

export function Leaderboard({ leaderboard, compact }) {
  return (
    <div style={{ background: "rgba(244,239,230,0.08)", borderRadius: 12, overflow: "hidden" }}>
      {leaderboard.map((entry, i) => (
        <div
          key={entry.player}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: compact ? "8px 14px" : "12px 16px",
            borderBottom: i < leaderboard.length - 1 ? "1px solid rgba(244,239,230,0.1)" : "none",
          }}
        >
          <div style={{ width: 22, fontWeight: 800, fontSize: compact ? 13 : 15, opacity: i < 3 ? 1 : 0.6 }}>
            {i + 1}
          </div>
          <div
            style={{
              flex: 1,
              fontSize: compact ? 13.5 : 15,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.player}
          </div>
          <div style={{ fontSize: compact ? 12 : 13, opacity: 0.6 }}>{entry.played}p</div>
          <div style={{ fontSize: compact ? 15 : 18, fontWeight: 800, minWidth: 32, textAlign: "right" }}>
            {entry.points}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ToggleBtn({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 12px",
        borderRadius: 8,
        border: `2px solid ${active ? CLAY : "#e3ddd0"}`,
        background: active ? CLAY : "transparent",
        color: active ? LINE : COURT_GREEN,
        fontWeight: 700,
        fontSize: 12.5,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
