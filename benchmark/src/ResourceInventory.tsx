import React from "react";
import type { ResourceRecord } from "react-fastload";

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const cellStyle: React.CSSProperties = { padding: "4px 8px", borderBottom: "1px solid #eee", textAlign: "left" };

function fmtBytes(n: number | undefined | null): string {
  if (!n) return "—";
  if (n > 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  return `${(n / 1000).toFixed(0)} KB`;
}

function resolveUrl(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

/**
 * Cache heuristic shared with metrics.ts: transferSize === 0 with a
 * nonzero decoded body usually means a cache hit. Not 100% reliable for
 * opaque cross-origin responses without Timing-Allow-Origin — shown as
 * "?" when we can't tell (no matching Resource Timing entry yet, i.e.
 * the resource hasn't loaded in this browser session at all).
 */
function cacheStatusFor(url: string | undefined, entries: PerformanceResourceTiming[]): "hit" | "miss" | "?" {
  if (!url) return "?";
  const resolved = resolveUrl(url);
  const entry = entries.find((e) => e.name === resolved);
  if (!entry) return "?";
  return entry.transferSize === 0 && entry.decodedBodySize > 0 ? "hit" : "miss";
}

/**
 * Answers the reviewer's core ask: don't just say "3 deferred" — show
 * WHICH resources, how large, and what state they're in. For ReactFastLoad
 * this reads straight from the scheduler's own registry (ground truth for
 * what it decided). For Baseline there is no such registry — this is
 * reconstructed from real Resource Timing entries instead.
 */
export function FastLoadResourceInventory({ resources }: { resources: ResourceRecord[] }) {
  const sorted = resources.slice().sort((a, b) => (b.estimatedSize ?? 0) - (a.estimatedSize ?? 0));
  const initialBytes = sorted.filter((r) => !r.deferred).reduce((s, r) => s + (r.estimatedSize ?? 0), 0);
  const deferredBytes = sorted.filter((r) => r.deferred).reduce((s, r) => s + (r.estimatedSize ?? 0), 0);
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Resource inventory (from the scheduler's registry)</h3>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        Initial (est.): {fmtBytes(initialBytes)} · Deferred (est.): {fmtBytes(deferredBytes)} — estimates only where
        an <code>estimatedSize</code> prop was supplied; see docs/METHODOLOGY.md. State names below use the
        scheduler's own vocabulary (idle/eligible/loading/loaded/error) — "discovered → requested → started →
        completed" in the reviewer's terms, with no distinct "aborted" state implemented yet (see docs/ROADMAP.md).
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cellStyle}>Resource</th>
            <th style={cellStyle}>Type</th>
            <th style={cellStyle}>Priority</th>
            <th style={cellStyle}>Size (est.)</th>
            <th style={cellStyle}>State</th>
            <th style={cellStyle}>Cache</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.id}>
              <td style={cellStyle}>{r.id}</td>
              <td style={cellStyle}>{r.type}</td>
              <td style={cellStyle}>{r.priority}</td>
              <td style={cellStyle}>{fmtBytes(r.estimatedSize)}</td>
              <td style={cellStyle}>
                {r.state}
                {r.deferred ? " (deferred)" : ""}
              </td>
              <td style={cellStyle}>{cacheStatusFor(r.meta?.src as string | undefined, entries)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface BaselineResourceRow {
  name: string;
  url: string;
  transferSize: number;
  requestedAfterLoad: boolean;
  cacheStatus: "hit" | "miss";
}

export function readBaselineResourceInventory(): BaselineResourceRow[] {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const loadEnd = nav ? nav.loadEventEnd : Infinity;
  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];

  return entries
    .map((e) => ({
      name: e.name.split("/").pop() || e.name,
      url: e.name,
      transferSize: e.transferSize || 0,
      requestedAfterLoad: e.startTime > loadEnd,
      cacheStatus: (e.transferSize === 0 && e.decodedBodySize > 0 ? "hit" : "miss") as "hit" | "miss",
    }))
    .sort((a, b) => b.transferSize - a.transferSize);
}

export function BaselineResourceInventory({ rows }: { rows: BaselineResourceRow[] }) {
  const before = rows.filter((r) => !r.requestedAfterLoad).reduce((s, r) => s + r.transferSize, 0);
  const after = rows.filter((r) => r.requestedAfterLoad).reduce((s, r) => s + r.transferSize, 0);

  return (
    <div style={{ marginTop: 24 }}>
      <h3>Resource inventory (from real Resource Timing entries)</h3>
      <p style={{ fontSize: 13, opacity: 0.75 }}>
        Requested before <code>load</code>: {fmtBytes(before)} · after <code>load</code> (native lazy loading
        deferred these): {fmtBytes(after)}. {rows.length} resources total.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={cellStyle}>Resource</th>
            <th style={cellStyle}>Transferred</th>
            <th style={cellStyle}>Timing</th>
            <th style={cellStyle}>Cache</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 60).map((r, i) => (
            <tr key={i}>
              <td style={cellStyle}>{r.name}</td>
              <td style={cellStyle}>{fmtBytes(r.transferSize)}</td>
              <td style={cellStyle}>{r.requestedAfterLoad ? "after load" : "before load"}</td>
              <td style={cellStyle}>{r.cacheStatus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
