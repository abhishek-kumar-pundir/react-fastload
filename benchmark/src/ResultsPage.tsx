import React from "react";
import { getScenario, getRunInfo } from "./url";
import { getRuns, summarize, clearRuns, type RunRecord } from "./runHarness";
import { SCENARIOS } from "./data";

function fmtStat(stat: { median: number | null; p75: number | null; p95: number | null; n: number }, unit: string) {
  if (stat.n === 0) return "—";
  const f = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100) / 100}${unit}`);
  return `${f(stat.median)} (p75 ${f(stat.p75)}, p95 ${f(stat.p95)}, n=${stat.n})`;
}

function metricRow(label: string, baseline: RunRecord[], fastload: RunRecord[], field: keyof RunRecord, unit: string) {
  const b = summarize(baseline.map((r) => r[field] as number | null));
  const f = summarize(fastload.map((r) => r[field] as number | null));
  return (
    <tr key={label}>
      <td style={{ padding: "6px 10px", fontWeight: 600 }}>{label}</td>
      <td style={{ padding: "6px 10px" }}>{fmtStat(b, unit)}</td>
      <td style={{ padding: "6px 10px" }}>{fmtStat(f, unit)}</td>
    </tr>
  );
}

function sectionHeader(label: string) {
  return (
    <tr key={`section-${label}`}>
      <td colSpan={3} style={{ padding: "12px 10px 4px", fontWeight: 700, borderBottom: "1px solid #333", opacity: 0.85 }}>
        {label}
      </td>
    </tr>
  );
}

/**
 * Aggregates every run recorded for this scenario into median/p75/p95 per
 * metric. INITIAL LOAD, SCHEDULER, and EVENTUAL are reported as separate
 * sections deliberately — collapsing them into one "Transferred" number is
 * exactly the instrumentation bug this rewrite fixes: it looked like the
 * library only ever downloads a few KB, when what it actually does is
 * shrink the CRITICAL window and reschedule the rest, not eliminate it.
 * See docs/METHODOLOGY.md for the window definitions and caveats.
 */
export default function ResultsPage() {
  const scenarioName = getScenario();
  const scenario = SCENARIOS[scenarioName];
  const { totalRuns } = getRunInfo();
  const all = getRuns(scenarioName);
  const baseline = all.filter((r) => r.mode === "baseline");
  const fastload = all.filter((r) => r.mode === "fastload");

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h1>Results — {scenario.label} scenario</h1>
      <p style={{ opacity: 0.75 }}>{scenario.description}</p>
      <p>
        {baseline.length} baseline run(s), {fastload.length} ReactFastLoad run(s) recorded
        {totalRuns ? ` (target: ${totalRuns} each)` : ""}.
      </p>

      {all.length === 0 ? (
        <p>No runs recorded yet for this scenario. Go back and click "Start N-run comparison".</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333", textAlign: "left" }}>
              <th style={{ padding: "6px 10px" }}>Metric</th>
              <th style={{ padding: "6px 10px" }}>Baseline</th>
              <th style={{ padding: "6px 10px" }}>ReactFastLoad</th>
            </tr>
          </thead>
          <tbody>
            {sectionHeader("INITIAL LOAD (until the load event)")}
            {metricRow("FCP", baseline, fastload, "fcp", "ms")}
            {metricRow("LCP", baseline, fastload, "lcp", "ms")}
            {metricRow("TTFB", baseline, fastload, "ttfb", "ms")}
            {metricRow("CLS", baseline, fastload, "cls", "")}
            {metricRow("Initial requests", baseline, fastload, "initialRequests", "")}
            {metricRow("Initial bytes transferred", baseline, fastload, "initialTransferredBytes", " B")}

            {sectionHeader("SCHEDULER (ReactFastLoad's own bookkeeping — null for Baseline)")}
            {metricRow("Deferred requests", baseline, fastload, "deferredRequests", "")}
            {metricRow("Estimated deferred bytes", baseline, fastload, "estimatedDeferredBytes", " B")}
            {metricRow(
              "Actually deferred bytes (measured, resources loaded by the eventual snapshot)",
              baseline,
              fastload,
              "actuallyDeferredBytes",
              " B"
            )}

            {sectionHeader("EVENTUAL (network-idle heuristic or 12s cap — see docs/METHODOLOGY.md)")}
            {metricRow("Eventual requests", baseline, fastload, "eventualRequests", "")}
            {metricRow("Eventual bytes transferred", baseline, fastload, "eventualTransferredBytes", " B")}
            {metricRow("Cache hits (heuristic)", baseline, fastload, "cacheHits", "")}
            {metricRow("Cache misses (heuristic)", baseline, fastload, "cacheMisses", "")}
          </tbody>
        </table>
      )}

      <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
        <a href="/">← Back</a>
        <button
          onClick={() => {
            clearRuns(scenarioName);
            window.location.reload();
          }}
        >
          Clear runs for this scenario
        </button>
      </div>

      <div style={{ marginTop: 32, fontSize: 13, opacity: 0.7, maxWidth: 640 }}>
        ⚠ These runs share the browser's HTTP cache and connection state
        between steps — this is a client-only approximation, not a
        controlled lab measurement. "Eventual" is a network-idle heuristic
        (resource count unchanged for ~1.2s, or a 12s hard cap), not a
        guarantee of the page's full resource lifetime — resources that
        only load on a scroll/interaction that never happens during an
        automated run won't appear in either window. See
        docs/METHODOLOGY.md for the full breakdown and for how to run a
        stricter comparison (private windows, throttling, or an external
        tool like Lighthouse CI).
      </div>

      <details style={{ marginTop: 24 }}>
        <summary>Raw per-run data ({all.length} rows)</summary>
        <pre style={{ fontSize: 11, overflow: "auto" }}>{JSON.stringify(all, null, 2)}</pre>
      </details>
    </div>
  );
}
