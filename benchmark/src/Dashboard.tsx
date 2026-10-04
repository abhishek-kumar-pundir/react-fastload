import React from "react";
import type { ResourceSnapshot, Vitals } from "./metrics";

function fmtMs(v: number | null): string {
  return v === null ? "measuring…" : `${Math.round(v)} ms`;
}
function fmtBytes(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return v > 1_000_000 ? `${(v / 1_000_000).toFixed(2)} MB` : `${(v / 1000).toFixed(0)} KB`;
}

const box: React.CSSProperties = {
  border: "1px solid #333",
  borderRadius: 8,
  padding: "10px 14px",
  minWidth: 200,
  background: "#161616",
  color: "#eee",
};
const boxTitle: React.CSSProperties = { fontWeight: 700, fontSize: 12, opacity: 0.7, marginBottom: 6, letterSpacing: 0.5 };
const row: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13, padding: "2px 0" };

export interface SchedulerBoxData {
  deferredRequests: number;
  estimatedDeferredBytes: number;
  actuallyDeferredBytes: { bytes: number; matchedCount: number } | null;
}

export interface DashboardProps {
  title: string;
  vitals: Vitals;
  initial: { requests: number; transferredBytes: number };
  eventual: ResourceSnapshot;
  scheduler?: SchedulerBoxData;
}

/**
 * The three-panel dashboard: INITIAL LOAD / SCHEDULER (ReactFastLoad only)
 * / EVENTUAL (so far). Deliberately does NOT show a single "Transferred"
 * number the way the old dashboard did — that conflated "what's been
 * sent so far" with "everything this page will ever request," which
 * reads as a much bigger win than it is. See docs/METHODOLOGY.md.
 */
export function Dashboard({ title, vitals, initial, eventual, scheduler }: DashboardProps) {
  return (
    <div style={{ position: "sticky", top: 0, zIndex: 10, background: "#0a0a0a", padding: "10px 16px" }}>
      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 8, fontFamily: "monospace" }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontFamily: "monospace" }}>
        <div style={box}>
          <div style={boxTitle}>INITIAL LOAD (until the `load` event)</div>
          <div style={row}><span>FCP</span><span>{fmtMs(vitals.fcp)}</span></div>
          <div style={row}><span>LCP</span><span>{fmtMs(vitals.lcp)}</span></div>
          <div style={row}><span>TTFB</span><span>{fmtMs(vitals.ttfb)}</span></div>
          <div style={row}><span>CLS</span><span>{vitals.cls ?? "measuring…"}</span></div>
          <div style={row}><span>Requests</span><span>{initial.requests}</span></div>
          <div style={row}><span>Bytes transferred</span><span>{fmtBytes(initial.transferredBytes)}</span></div>
        </div>

        {scheduler && (
          <div style={box}>
            <div style={boxTitle}>SCHEDULER (ReactFastLoad's own bookkeeping)</div>
            <div style={row}><span>Deferred requests</span><span>{scheduler.deferredRequests}</span></div>
            <div style={row}><span>Est. deferred bytes</span><span>{fmtBytes(scheduler.estimatedDeferredBytes)}</span></div>
            <div style={row}>
              <span>Actually deferred bytes</span>
              <span>
                {scheduler.actuallyDeferredBytes
                  ? `${fmtBytes(scheduler.actuallyDeferredBytes.bytes)} (${scheduler.actuallyDeferredBytes.matchedCount} loaded)`
                  : "none loaded yet"}
              </span>
            </div>
          </div>
        )}

        <div style={box}>
          <div style={boxTitle}>EVENTUAL (so far — keep watching)</div>
          <div style={row}><span>Requests</span><span>{eventual.requests}</span></div>
          <div style={row}><span>Bytes transferred</span><span>{fmtBytes(eventual.transferredBytes)}</span></div>
          <div style={row}><span>Cache hits</span><span>{eventual.cacheHits}</span></div>
          <div style={row}><span>Cache misses</span><span>{eventual.cacheMisses}</span></div>
        </div>
      </div>
    </div>
  );
}
