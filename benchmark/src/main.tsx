import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Global, mode-agnostic LCP/CLS collection so the Baseline page (which has
// no ReactFastLoad WebVitals collector) can still report real browser-
// measured values through the same metrics.ts readers as the
// ReactFastLoad page.
if ("PerformanceObserver" in window) {
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries() as Array<PerformanceEntry & { renderTime?: number; loadTime?: number }>;
      const last = entries[entries.length - 1];
      if (last) {
        (window as any).__benchmarkLCP = last.renderTime || last.loadTime || last.startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch {
    /* unsupported */
  }

  try {
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) cls += entry.value;
      }
      (window as any).__benchmarkCLS = cls;
    }).observe({ type: "layout-shift", buffered: true });
  } catch {
    /* unsupported */
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
