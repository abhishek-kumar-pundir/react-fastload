import { useCallback, useEffect, useRef, useState } from "react";
import { LoadManager, type SchedulerDecision } from "react-fastload";
import { registerAllEager, buildTimelineRows, type SyntheticSpec, type TimelineRow } from "./synthetic";

export interface LabRunResult {
  rows: TimelineRow[];
  decisions: SchedulerDecision[];
  running: boolean;
  run: () => void;
}

/**
 * Drives one Scenario Lab panel. Two modes:
 *
 * - enabled=true: builds a REAL LoadManager with the given concurrency
 *   and registers every spec as eager, so the real Scheduler/
 *   PriorityEngine decide dispatch order. Timeline rows come straight
 *   from ResourceRecord.timestamps.
 * - enabled=false ("Baseline" toggle): no LoadManager at all — every
 *   resource "starts" at t=0 with no queueing, simulating what happens
 *   with no scheduler coordinating anything. This is the honest baseline
 *   for a SCHEDULER comparison specifically — it says nothing about real
 *   network behavior, only about ordering/concurrency control.
 */
export function useLabRun(specs: SyntheticSpec[], concurrency: number, enabled: boolean): LabRunResult {
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [decisions, setDecisions] = useState<SchedulerDecision[]>([]);
  const [running, setRunning] = useState(false);
  const managerRef = useRef<LoadManager | null>(null);

  useEffect(() => {
    return () => managerRef.current?.destroy();
  }, []);

  const run = useCallback(() => {
    managerRef.current?.destroy();
    setRows([]);
    setDecisions([]);
    setRunning(true);

    const origin = performance.now();

    if (!enabled) {
      const initial: TimelineRow[] = specs.map((s) => ({
        id: s.id,
        priority: s.priority,
        state: "loading",
        eligibleAtMs: 0,
        startedAtMs: 0,
        completedAtMs: null,
        queueWaitMs: 0,
      }));
      setRows(initial);

      let remaining = specs.length;
      specs.forEach((s) => {
        setTimeout(() => {
          setRows((prev) =>
            prev.map((r) => (r.id === s.id ? { ...r, completedAtMs: s.durationMs, state: "loaded" } : r))
          );
          remaining -= 1;
          if (remaining <= 0) setRunning(false);
        }, s.durationMs);
      });
      return;
    }

    // debug:false — the scheduler's decision log (read via
    // getDecisionLog() below) is always recorded regardless of this flag;
    // `debug` only controls extra console.debug output, which would just
    // be noise during a lab run.
    const manager = new LoadManager({ concurrency, preloadDistance: 1000, debug: false });
    managerRef.current = manager;

    const unsubscribe = manager.registry.subscribe((all) => {
      setRows(buildTimelineRows(all, origin));
      setDecisions(manager.scheduler.getDecisionLog());
      if (all.length > 0 && all.every((r) => r.state === "loaded" || r.state === "error")) {
        setRunning(false);
        unsubscribe();
      }
    });

    registerAllEager(manager, specs);
    setRows(buildTimelineRows(manager.registry.all(), origin));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specs, concurrency, enabled]);

  return { rows, decisions, running, run };
}
