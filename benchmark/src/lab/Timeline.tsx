import React from "react";
import type { TimelineRow } from "./synthetic";

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  NORMAL: "#eab308",
  LOW: "#3b82f6",
  IDLE: "#6b7280",
};

/**
 * Renders real registry timestamps as a table + lightweight bar chart
 * (plain divs, no charting dependency). Every number shown comes directly
 * from ResourceRecord.timestamps — nothing here is simulated or
 * interpolated for visual effect.
 */
export function Timeline({ rows, scaleMs }: { rows: TimelineRow[]; scaleMs: number }) {
  return (
    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #333" }}>
            <th style={{ padding: "4px 8px" }}>Resource</th>
            <th style={{ padding: "4px 8px" }}>Priority</th>
            <th style={{ padding: "4px 8px" }}>Eligible</th>
            <th style={{ padding: "4px 8px" }}>Started</th>
            <th style={{ padding: "4px 8px" }}>Completed</th>
            <th style={{ padding: "4px 8px" }}>Queue wait</th>
            <th style={{ padding: "4px 8px" }}>State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #1f1f1f" }}>
              <td style={{ padding: "4px 8px" }}>{r.id}</td>
              <td style={{ padding: "4px 8px", color: PRIORITY_COLOR[r.priority] }}>{r.priority}</td>
              <td style={{ padding: "4px 8px" }}>{fmt(r.eligibleAtMs)}</td>
              <td style={{ padding: "4px 8px" }}>{fmt(r.startedAtMs)}</td>
              <td style={{ padding: "4px 8px" }}>{fmt(r.completedAtMs)}</td>
              <td style={{ padding: "4px 8px" }}>{fmt(r.queueWaitMs)}</td>
              <td style={{ padding: "4px 8px" }}>{r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 90, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.id}</div>
            <div style={{ position: "relative", flex: 1, height: 14, background: "#1a1a1a", borderRadius: 3 }}>
              {r.startedAtMs != null && (
                <div
                  title={`queued ${r.eligibleAtMs ?? 0}ms \u2192 started ${r.startedAtMs}ms`}
                  style={{
                    position: "absolute",
                    left: `${pct(r.eligibleAtMs ?? 0, scaleMs)}%`,
                    width: `${pct((r.startedAtMs - (r.eligibleAtMs ?? 0)) || 0.5, scaleMs)}%`,
                    top: 0,
                    bottom: 0,
                    background: "#3f3f46",
                    borderRadius: 3,
                  }}
                />
              )}
              {r.startedAtMs != null && (
                <div
                  title={`loading ${r.startedAtMs}ms \u2192 ${r.completedAtMs ?? "…"}ms`}
                  style={{
                    position: "absolute",
                    left: `${pct(r.startedAtMs, scaleMs)}%`,
                    width: `${pct((r.completedAtMs ?? scaleMs) - r.startedAtMs, scaleMs)}%`,
                    top: 0,
                    bottom: 0,
                    background: PRIORITY_COLOR[r.priority] ?? "#888",
                    borderRadius: 3,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function fmt(ms: number | null): string {
  return ms === null ? "—" : `${Math.round(ms)}ms`;
}
function pct(ms: number, scaleMs: number): number {
  return Math.max(0, Math.min(100, (ms / scaleMs) * 100));
}
