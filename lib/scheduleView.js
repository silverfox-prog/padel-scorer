import { LINE, COURT_GREEN, CLAY } from "./ui";

export function ScheduleView({ rounds, onRoundClick, sessionMode }) {
  if (!rounds || rounds.length === 0) {
    return <div style={{ padding: 16, textAlign: "center", opacity: 0.7 }}>No rounds yet.</div>;
  }

  return (
    <div>
      {rounds.map((round, idx) => (
        <button
          key={round.id}
          onClick={() => onRoundClick && onRoundClick(idx)}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            background: round.completed_at ? "rgba(244,239,230,0.08)" : "rgba(244,239,230,0.04)",
            border: "1px solid rgba(244,239,230,0.1)",
            color: LINE,
            cursor: "pointer",
            textAlign: "left",
            marginBottom: 4,
          }}
        >
          <div style={{ minWidth: 40, fontSize: 13, fontWeight: 700, opacity: 0.7 }}>
            R{idx + 1}
          </div>
          <div style={{ flex: 1 }}>
            {round.team_a_names && round.team_b_names ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {round.team_a_names.join(" & ")} vs {round.team_b_names.join(" & ")}
                </div>
                {round.sit_out_names && round.sit_out_names.length > 0 && (
                  <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                    Sit out: {round.sit_out_names.join(", ")}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13 }}>Round {idx + 1}</div>
            )}
          </div>
          {round.score_a != null && round.score_b != null ? (
            <div style={{ fontSize: 14, fontWeight: 700, minWidth: 60, textAlign: "right" }}>
              {round.score_a} — {round.score_b}
            </div>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.5 }}>Not started</div>
          )}
        </button>
      ))}
    </div>
  );
}
