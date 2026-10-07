/**
 * Synthetic resources for the Scenario Lab.
 *
 * The Light/Heavy/Extreme pages (BaselinePage/FastLoadPage) measure real
 * network behavior with real images — useful, but noisy: priority and
 * concurrency effects can get lost in real network variance.
 *
 * The Scenario Lab instead uses the REAL LoadManager/Scheduler/
 * PriorityEngine (the exact exported classes a consuming app could also
 * use) with a deterministic, artificial-delay "loader" instead of a real
 * network fetch. This isolates the SCHEDULER's own behavior — ordering,
 * concurrency, viewport gating, deduplication — from network/CPU/browser
 * variance, so what's demonstrated is provably the scheduler's doing, not
 * a lucky network run. Every lab panel labels this explicitly: these are
 * controlled scheduler demonstrations, not a measurement of real page
 * load performance.
 */
import { LoadManager, type ResourceRecord, type Priority } from "react-fastload";

export interface SyntheticSpec {
  id: string;
  priority: Priority;
  /** How long the fake "load" takes, in ms. Deterministic — not real network timing. */
  durationMs: number;
}

/** A controllable fake loader: resolves after `durationMs`, honors abort. */
export function createSyntheticLoader(durationMs: number) {
  return (resource: ResourceRecord) =>
    new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, durationMs);
      resource.abortController?.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Synthetic load aborted", "AbortError"));
        },
        { once: true }
      );
    });
}

/**
 * Registers every spec as "eager" (immediately eligible, no viewport
 * gating) so the lab can isolate priority+concurrency ordering without
 * also depending on scroll position. Returns an unregister-all function.
 */
export function registerAllEager(manager: LoadManager, specs: SyntheticSpec[]): () => void {
  for (const spec of specs) {
    manager.register({ id: spec.id, type: "other", priority: spec.priority, strategy: "eager" });
    manager.setLoader(spec.id, createSyntheticLoader(spec.durationMs));
  }
  return () => specs.forEach((spec) => manager.unregister(spec.id));
}

export interface TimelineRow {
  id: string;
  priority: Priority;
  state: ResourceRecord["state"];
  /** ms since the lab run started registering resources. Null if that timestamp hasn't happened yet. */
  eligibleAtMs: number | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  queueWaitMs: number | null;
}

/** Pure function — easy to unit test without touching the DOM or timers. */
export function buildTimelineRows(records: ResourceRecord[], originMs: number): TimelineRow[] {
  return records
    .map((r) => {
      const eligibleAtMs = r.timestamps.eligibleAt != null ? r.timestamps.eligibleAt - originMs : null;
      const startedAtMs = r.timestamps.loadStartedAt != null ? r.timestamps.loadStartedAt - originMs : null;
      const completedAtMs = r.timestamps.loadEndedAt != null ? r.timestamps.loadEndedAt - originMs : null;
      const queueWaitMs =
        eligibleAtMs != null && startedAtMs != null ? Math.max(0, startedAtMs - eligibleAtMs) : null;
      return { id: r.id, priority: r.priority, state: r.state, eligibleAtMs, startedAtMs, completedAtMs, queueWaitMs };
    })
    .sort((a, b) => (a.eligibleAtMs ?? Infinity) - (b.eligibleAtMs ?? Infinity));
}
