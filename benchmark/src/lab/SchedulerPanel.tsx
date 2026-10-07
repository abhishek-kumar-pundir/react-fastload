import React from "react";
import type { ResourceRecord, SchedulerDecision } from "react-fastload";

/**
 * Live scheduler state: counts derived from the registry's own `state`
 * field (idle/eligible/loading/loaded/error), plus the real decision log
 * from `scheduler.getDecisionLog()`. `configuredConcurrency` is passed in
 * by the caller because it's whatever concurrency THAT lab panel
 * constructed its LoadManager with — Scheduler doesn't expose it as a
 * public reactive value, and re-deriving it from behavior would be a
 * guess, not a measurement.
 */
export function SchedulerPanel({
  resources,
  decisions,
  configuredConcurrency,
}: {
  resources: Pick<ResourceRecord, "id" | "priority" | "state">[];
  decisions: SchedulerDecision[];
  configuredConcurrency: number;
}) {
  const queued = resources.filter((r) => r.state === "eligible").length;
  const active = resources.filter((r) => r.state === "loading").length;
  const completed = resources.filter((r) => r.state === "loaded").length;
  const idle = resources.filter((r) => r.state === "idle").length;
  const errored = resources.filter((r) => r.state === "error").length;

  return (
    <div style={{ fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, flexWrap: "wrap" }}>
        <Stat label="Active" value={`${active} / ${configuredConcurrency}`} />
        <Stat label="Queued" value={queued} />
        <Stat label="Idle" value={idle} />
        <Stat label="Completed" value={completed} />
        {errored > 0 && <Stat label="Errored" value={errored} />}
      </div>
      <div style={{ opacity: 0.7, marginBottom: 4 }}>Recent scheduler decisions</div>
      <div style={{ maxHeight: 140, overflow: "auto", background: "#141414", borderRadius: 4, padding: 8 }}>
        {decisions.length === 0 && <div style={{ opacity: 0.5 }}>No decisions yet</div>}
        {decisions
          .slice(-12)
          .reverse()
          .map((d, i) => (
            <div key={i} style={{ padding: "2px 0" }}>
              <strong>{d.action}</strong> {d.resourceId} — {d.reason}
            </div>
          ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        background: "#161616",
        border: "1px solid #2a2a2a",
        borderRadius: 6,
        padding: "6px 12px",
        minWidth: 70,
      }}
    >
      <div style={{ opacity: 0.6, fontSize: 10 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
