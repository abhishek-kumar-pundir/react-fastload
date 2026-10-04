import { useEffect, useState } from "react";
import { useFastLoadContext } from "../components/FastLoadProvider";
import type { FastLoadMetrics } from "../metrics/MetricsCollector";

/**
 * Returns a live-updating FastLoadMetrics snapshot. Re-renders when:
 * - a browser Web Vitals entry arrives (FCP/LCP/CLS), or
 * - the resource registry changes (a resource loads, defers, etc.)
 *
 * The returned object always reflects real state at the time of the
 * render that produced it — see FastLoadMetrics' field-level docs for
 * which values are browser-observed vs. internal bookkeeping.
 */
export function useFastLoadMetrics(): FastLoadMetrics {
  const { loadManager, metricsCollector } = useFastLoadContext();
  const [metrics, setMetrics] = useState<FastLoadMetrics>(() => metricsCollector.snapshot());

  useEffect(() => {
    const refresh = () => setMetrics(metricsCollector.snapshot());

    const unsubVitals = metricsCollector.subscribeWebVitals(refresh);
    const unsubRegistry = loadManager.registry.subscribe(refresh);

    refresh();

    return () => {
      unsubVitals();
      unsubRegistry();
    };
  }, [loadManager, metricsCollector]);

  return metrics;
}
