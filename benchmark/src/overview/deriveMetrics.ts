import { computeSpan, summarizeRuns } from "../lab/derivedMetrics";
import type { TimelineRow } from "../lab/synthetic";

/**
 * Headline numbers for the Overview. Nothing is computed here that the lab
 * does not already compute — this only reuses the lab's own documented
 * functions (computeSpan / summarizeRuns) over the same TimelineRow data.
 *
 * Formulas (all values in ms since the run started; rows come from the
 * scheduler registry's real timestamps):
 *
 *  - resources        = number of registered resources.
 *  - firstDispatchMs  = min(startedAtMs) across resources that have started.
 *  - medianQueueWaitMs= median(startedAtMs - eligibleAtMs) across resources
 *                       that have started (the lab's queueWaitMs).
 *  - completionSpanMs = max(completedAtMs) - min(startedAtMs). Reported
 *                       only once EVERY resource has finished; null while
 *                       the run is still in progress.
 */
export interface OverviewMetrics {
  resources: number;
  started: number;
  active: number;
  queued: number;
  completed: number;
  allDone: boolean;
  firstDispatchMs: number | null;
  medianQueueWaitMs: number | null;
  completionSpanMs: number | null;
  /** Latest timestamp seen on any row (used to draw in-flight bars; not a metric). */
  lastObservedMs: number;
}

export function deriveOverviewMetrics(rows: TimelineRow[]): OverviewMetrics {
  const span = computeSpan(rows);
  const waits = rows.map((r) => r.queueWaitMs).filter((v): v is number => v !== null);
  const allDone = rows.length > 0 && rows.every((r) => r.state === "loaded" || r.state === "error");

  let lastObservedMs = 0;
  for (const r of rows) {
    for (const t of [r.eligibleAtMs, r.startedAtMs, r.completedAtMs]) {
      if (t !== null && t > lastObservedMs) lastObservedMs = t;
    }
  }

  return {
    resources: rows.length,
    started: rows.filter((r) => r.startedAtMs !== null).length,
    active: rows.filter((r) => r.state === "loading").length,
    queued: rows.filter((r) => r.state === "eligible").length,
    completed: rows.filter((r) => r.state === "loaded" || r.state === "error").length,
    allDone,
    firstDispatchMs: span.firstStartMs,
    medianQueueWaitMs: summarizeRuns(waits).median,
    completionSpanMs: allDone ? span.completionSpanMs : null,
    lastObservedMs,
  };
}

/** Axis end for the timeline: the planned span, or what was actually observed if that is larger. */
export function timelineScaleMs(plannedMs: number, observedMs: number): number {
  return Math.max(plannedMs, observedMs) * 1.03;
}

/** A "nice" tick step (ms) giving at most ~8 gridlines. */
export function niceTickStep(scaleMs: number): number {
  const steps = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  return steps.find((s) => scaleMs / s <= 8) ?? 5000;
}
