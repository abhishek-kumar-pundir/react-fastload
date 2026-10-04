import { useEffect, useRef } from "react";
import { getScenario, getRunInfo, buildUrl } from "./url";
import { recordRun, type RunRecord } from "./runHarness";
import {
  readAllResourceEntries,
  entriesBeforeLoad,
  summarizeEntries,
  readVitals,
  computeActuallyDeferredBytes,
  waitForNetworkIdle,
} from "./metrics";

export interface AutoRunnerProps {
  mode: "baseline" | "fastload";
  /** Only available on the ReactFastLoad page. A getter so we always read live registry state, not a stale value from mount time. */
  getSchedulerState?: () => { deferredRequests: number; estimatedDeferredBytes: number; deferredSrcs: string[] };
}

/**
 * Mounted invisibly on both pages when the URL carries `auto=1`. Captures
 * TWO snapshots per page load — an "initial" one at the `load` event and
 * an "eventual" one after a network-idle heuristic — then navigates to
 * the next step in the Baseline/FastLoad alternating sequence. See
 * metrics.ts for exactly what each window means, and
 * benchmark/README.md / docs/METHODOLOGY.md for this approach's real
 * limitations (shared HTTP cache between steps, no throttling control).
 */
export function AutoRunner({ mode, getSchedulerState }: AutoRunnerProps) {
  const hasRunRef = useRef(false);
  const getSchedulerRef = useRef(getSchedulerState);
  getSchedulerRef.current = getSchedulerState;

  useEffect(() => {
    const { auto, run, totalRuns } = getRunInfo();
    if (!auto || hasRunRef.current) return;

    const run_ = async () => {
      if (hasRunRef.current) return;
      hasRunRef.current = true;

      const scenario = getScenario();

      // --- INITIAL snapshot: right at the load event (+ small buffer) ---
      const initialVitals = readVitals();
      const initialEntries = entriesBeforeLoad(readAllResourceEntries());
      const initialSummary = summarizeEntries(initialEntries);
      const schedulerAtInitial = mode === "fastload" ? getSchedulerRef.current?.() : undefined;

      // --- EVENTUAL snapshot: after network-idle heuristic / hard cap ---
      await waitForNetworkIdle();
      const eventualEntries = readAllResourceEntries();
      const eventualSummary = summarizeEntries(eventualEntries);
      const schedulerAtEventual = mode === "fastload" ? getSchedulerRef.current?.() : undefined;
      const actuallyDeferred =
        mode === "fastload" && schedulerAtEventual
          ? computeActuallyDeferredBytes(schedulerAtEventual.deferredSrcs, eventualEntries)
          : null;

      const record: RunRecord = {
        scenario,
        mode,
        run,
        fcp: initialVitals.fcp,
        lcp: initialVitals.lcp,
        cls: initialVitals.cls,
        ttfb: initialVitals.ttfb,
        initialRequests: initialSummary.requests,
        initialTransferredBytes: initialSummary.transferredBytes,
        deferredRequests: schedulerAtInitial?.deferredRequests ?? null,
        estimatedDeferredBytes: schedulerAtInitial?.estimatedDeferredBytes ?? null,
        actuallyDeferredBytes: actuallyDeferred?.bytes ?? null,
        actuallyDeferredMatchedCount: actuallyDeferred?.matchedCount ?? null,
        eventualRequests: eventualSummary.requests,
        eventualTransferredBytes: eventualSummary.transferredBytes,
        cacheHits: eventualSummary.cacheHits,
        cacheMisses: eventualSummary.cacheMisses,
      };

      recordRun(record);

      const next =
        mode === "baseline"
          ? buildUrl({ mode: "fastload", scenario, auto: true, run, totalRuns })
          : run < totalRuns
            ? buildUrl({ mode: "baseline", scenario, auto: true, run: run + 1, totalRuns })
            : buildUrl({ mode: "results", scenario, totalRuns });

      window.location.href = next;
    };

    const start = () => {
      window.setTimeout(() => void run_(), 100);
    };

    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start, { once: true });
    }

    return () => window.removeEventListener("load", start);
  }, [mode]);

  return null;
}
