import { supportsPerformanceObserver } from "../utils/browserSupport";

export type PerfEntryCallback = (entries: PerformanceEntry[]) => void;

/**
 * Thin wrapper around the native PerformanceObserver, used by the metrics
 * layer to collect Paint Timing, LCP, CLS, and Resource Timing entries.
 * Every subscription degrades gracefully: if a given `entryType` isn't
 * supported by the browser, `observe` simply never fires for it instead
 * of throwing.
 */
export class BrowserPerformanceObserver {
  private observers: PerformanceObserver[] = [];

  observe(entryTypes: string[], callback: PerfEntryCallback, options?: { buffered?: boolean }): void {
    if (!supportsPerformanceObserver()) return;

    for (const type of entryTypes) {
      try {
        const observer = new PerformanceObserver((list) => {
          callback(list.getEntries());
        });
        observer.observe({ type, buffered: options?.buffered ?? true } as PerformanceObserverInit);
        this.observers.push(observer);
      } catch {
        // Entry type unsupported in this browser (e.g. "largest-contentful-paint"
        // on older Firefox). Skip silently rather than crashing the app.
      }
    }
  }

  disconnect(): void {
    for (const observer of this.observers) observer.disconnect();
    this.observers = [];
  }
}
