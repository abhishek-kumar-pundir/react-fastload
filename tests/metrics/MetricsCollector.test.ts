import { describe, it, expect, afterEach } from "vitest";
import { LoadManager } from "../../src/core/LoadManager";
import { MetricsCollector } from "../../src/metrics/MetricsCollector";

describe("MetricsCollector", () => {
  let manager: LoadManager;

  afterEach(() => {
    manager?.destroy();
  });

  it("derives initial/deferred counts from the LoadManager's registry", () => {
    manager = new LoadManager({ preloadDistance: 1000 });
    const collector = new MetricsCollector(manager);

    manager.register({ id: "critical-img", type: "image", priority: "CRITICAL", strategy: "eager" });
    manager.register({ id: "lazy-img", type: "image", priority: "LOW", strategy: "lazy", estimatedSize: 4096 });
    manager.reportViewportDistance("lazy-img", 5000); // far outside preload zone -> deferred

    const snapshot = collector.snapshot();
    expect(snapshot.initialRequests).toBe(1);
    expect(snapshot.deferredRequests).toBe(1);
    expect(snapshot.imagesDeferred).toBe(1);
    expect(snapshot.bytesDeferred).toBe(4096);
  });

  it("never fabricates browser-observed fields — they stay null without real PerformanceObserver entries", () => {
    manager = new LoadManager();
    const collector = new MetricsCollector(manager);
    collector.start();

    const snapshot = collector.snapshot();
    // jsdom doesn't emit real paint/LCP/CLS entries, so these must remain
    // null rather than being estimated or defaulted to 0.
    expect(snapshot.fcp).toBeNull();
    expect(snapshot.lcp).toBeNull();
    expect(snapshot.cls).toBeNull();
  });
});
