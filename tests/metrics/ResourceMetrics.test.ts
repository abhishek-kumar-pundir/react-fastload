import { describe, it, expect, vi, afterEach } from "vitest";
import { getNavigationMetrics, getResourceTimingSummary } from "../../src/metrics/ResourceMetrics";

describe("ResourceMetrics", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns nulls when Navigation Timing entries are unavailable", () => {
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([] as any);
    expect(getNavigationMetrics()).toEqual({ ttfb: null, domContentLoaded: null, loadEvent: null });
  });

  it("computes ttfb/domContentLoaded from a navigation entry", () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) => {
      if (type === "navigation") {
        return [
          {
            startTime: 0,
            responseStart: 120,
            domContentLoadedEventEnd: 400,
            loadEventEnd: 900,
          },
        ] as any;
      }
      return [] as any;
    });

    const metrics = getNavigationMetrics();
    expect(metrics.ttfb).toBe(120);
    expect(metrics.domContentLoaded).toBe(400);
    expect(metrics.loadEvent).toBe(900);
  });

  it("sums transferSize and finds the slowest resource", () => {
    vi.spyOn(performance, "getEntriesByType").mockImplementation((type: string) => {
      if (type === "resource") {
        return [
          { transferSize: 1000, duration: 50 },
          { transferSize: 2000, duration: 300 },
        ] as any;
      }
      return [] as any;
    });

    const summary = getResourceTimingSummary();
    expect(summary.totalResources).toBe(2);
    expect(summary.totalTransferBytes).toBe(3000);
    expect(summary.slowestResourceMs).toBe(300);
  });
});
