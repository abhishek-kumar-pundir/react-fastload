import { BrowserPerformanceObserver } from "../observers/PerformanceObserver";
import { supportsNavigationTiming } from "../utils/browserSupport";

export interface WebVitalsSnapshot {
  /** First Contentful Paint, in ms. null until observed or if unsupported. */
  fcp: number | null;
  /** Largest Contentful Paint, in ms. Updates as later, larger candidates appear. */
  lcp: number | null;
  /** Cumulative Layout Shift score (unitless). Accumulates for the page's lifetime. */
  cls: number | null;
}

type Listener = (snapshot: WebVitalsSnapshot) => void;

/**
 * Collects real, browser-measured Core Web Vitals via PerformanceObserver.
 * This module does NOT estimate or simulate these values — if the browser
 * doesn't support a given entry type, the corresponding field simply stays
 * `null` rather than being backfilled with a guess.
 */
export class WebVitals {
  private snapshot: WebVitalsSnapshot = { fcp: null, lcp: null, cls: null };
  private listeners = new Set<Listener>();
  private perfObserver = new BrowserPerformanceObserver();
  private clsAccumulator = 0;

  start(): void {
    if (!supportsNavigationTiming()) return;

    this.perfObserver.observe(["paint"], (entries) => {
      for (const entry of entries) {
        if (entry.name === "first-contentful-paint") {
          this.update({ fcp: entry.startTime });
        }
      }
    });

    this.perfObserver.observe(["largest-contentful-paint"], (entries) => {
      const last = entries[entries.length - 1] as (PerformanceEntry & { renderTime?: number; loadTime?: number }) | undefined;
      if (last) {
        const value = last.renderTime || last.loadTime || last.startTime;
        this.update({ lcp: value });
      }
    });

    this.perfObserver.observe(["layout-shift"], (entries) => {
      for (const entry of entries as Array<PerformanceEntry & { value: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) {
          this.clsAccumulator += entry.value;
        }
      }
      this.update({ cls: this.clsAccumulator });
    });
  }

  getSnapshot(): WebVitalsSnapshot {
    return { ...this.snapshot };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  stop(): void {
    this.perfObserver.disconnect();
    this.listeners.clear();
  }

  private update(patch: Partial<WebVitalsSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener(this.snapshot);
  }
}
