import { WebVitals, type WebVitalsSnapshot } from "./WebVitals";
import { getNavigationMetrics, getResourceTimingSummary } from "./ResourceMetrics";
import type { LoadManager } from "../core/LoadManager";

/**
 * The metrics object returned by useFastLoadMetrics().
 *
 * Every field is documented with where its value actually comes from.
 * Nothing here is fabricated: browser-observed fields are `null` until
 * the browser has actually reported them, and internal counters are
 * derived directly from the registry's bookkeeping (never guessed).
 */
export interface FastLoadMetrics {
  // --- Browser-observed (PerformanceObserver / Paint Timing / LCP / CLS) ---
  /** First Contentful Paint in ms. Browser-observed. */
  fcp: number | null;
  /** Largest Contentful Paint in ms. Browser-observed; may update as the page loads. */
  lcp: number | null;
  /** Cumulative Layout Shift score. Browser-observed. */
  cls: number | null;
  /** Time to first byte in ms, from Navigation Timing. Browser-observed. */
  ttfb: number | null;

  // --- Browser-observed (Resource Timing) ---
  /** Total resources loaded for the page per the Resource Timing API. Browser-observed. */
  totalResourcesObserved: number;
  /** Total bytes transferred per Resource Timing (0 when transferSize is unavailable, e.g. opaque cross-origin responses). Browser-observed. */
  totalTransferBytesObserved: number;

  // --- ReactFastLoad internal (registry bookkeeping, not a browser measurement) ---
  /** Resources registered with ReactFastLoad that were NOT deferred (loaded on initial pass). Internal. */
  initialRequests: number;
  /** Resources registered with ReactFastLoad that the scheduler deferred past their natural load time. Internal. */
  deferredRequests: number;
  /** Same as deferredRequests; kept for API clarity per the requested shape. Internal. */
  deferredResources: number;
  /** Sum of estimatedSize across deferred resources. This is an ESTIMATE — see estimatedSize on each resource. Estimated. */
  bytesDeferred: number;
  imagesDeferred: number;
  videosDeferred: number;
  audiosDeferred: number;
  componentsDeferred: number;
}

/**
 * MetricsCollector composes browser-observed Web Vitals / Resource Timing
 * with the LoadManager's internal registry counters into one snapshot.
 * It never blends the two categories into a single "score" — the
 * distinction is preserved field-by-field, per the module's core
 * requirement not to present estimates as measurements.
 */
export class MetricsCollector {
  private webVitals = new WebVitals();
  private started = false;

  constructor(private loadManager: LoadManager) {}

  start(): void {
    if (this.started) return;
    this.started = true;
    this.webVitals.start();
  }

  stop(): void {
    this.webVitals.stop();
    this.started = false;
  }

  subscribeWebVitals(listener: (snapshot: WebVitalsSnapshot) => void): () => void {
    return this.webVitals.subscribe(listener);
  }

  snapshot(): FastLoadMetrics {
    const vitals = this.webVitals.getSnapshot();
    const nav = getNavigationMetrics();
    const resourceTiming = getResourceTimingSummary();
    const registrySummary = this.loadManager.registry.summary();

    return {
      fcp: vitals.fcp,
      lcp: vitals.lcp,
      cls: vitals.cls,
      ttfb: nav.ttfb,
      totalResourcesObserved: resourceTiming.totalResources,
      totalTransferBytesObserved: resourceTiming.totalTransferBytes,
      initialRequests: registrySummary.initialRequests,
      deferredRequests: registrySummary.deferredRequests,
      deferredResources: registrySummary.deferredResources,
      bytesDeferred: registrySummary.bytesDeferred,
      imagesDeferred: registrySummary.imagesDeferred,
      videosDeferred: registrySummary.videosDeferred,
      audiosDeferred: registrySummary.audiosDeferred,
      componentsDeferred: registrySummary.componentsDeferred,
    };
  }
}
