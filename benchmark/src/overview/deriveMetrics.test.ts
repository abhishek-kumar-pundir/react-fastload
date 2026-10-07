import { describe, it, expect } from "vitest";
import { deriveOverviewMetrics, niceTickStep, timelineScaleMs } from "./deriveMetrics";
import type { TimelineRow } from "../lab/synthetic";

const row = (over: Partial<TimelineRow>): TimelineRow => ({
  id: "r",
  priority: "NORMAL",
  state: "loaded",
  eligibleAtMs: 0,
  startedAtMs: 0,
  completedAtMs: 100,
  queueWaitMs: 0,
  ...over,
});

describe("deriveOverviewMetrics", () => {
  it("returns empty/null metrics for no rows (nothing invented)", () => {
    const m = deriveOverviewMetrics([]);
    expect(m).toMatchObject({
      resources: 0,
      allDone: false,
      firstDispatchMs: null,
      medianQueueWaitMs: null,
      completionSpanMs: null,
      lastObservedMs: 0,
    });
  });

  it("computes first dispatch, median queue wait and completion span from real timestamps", () => {
    const rows = [
      row({ id: "a", eligibleAtMs: 1, startedAtMs: 3, completedAtMs: 263, queueWaitMs: 2 }),
      row({ id: "b", eligibleAtMs: 1, startedAtMs: 4, completedAtMs: 264, queueWaitMs: 3 }),
      row({ id: "c", eligibleAtMs: 1, startedAtMs: 264, completedAtMs: 524, queueWaitMs: 263 }),
    ];
    const m = deriveOverviewMetrics(rows);
    expect(m.resources).toBe(3);
    expect(m.firstDispatchMs).toBe(3);
    expect(m.medianQueueWaitMs).toBe(3); // median of [2, 3, 263]
    expect(m.completionSpanMs).toBe(521); // 524 - 3
    expect(m.allDone).toBe(true);
    expect(m.completed).toBe(3);
  });

  it("averages the two middle values for an even number of queue waits", () => {
    const rows = [
      row({ queueWaitMs: 0 }),
      row({ queueWaitMs: 10 }),
      row({ queueWaitMs: 20 }),
      row({ queueWaitMs: 100 }),
    ];
    expect(deriveOverviewMetrics(rows).medianQueueWaitMs).toBe(15);
  });

  it("does NOT report a completion span while any resource is unfinished", () => {
    const rows = [
      row({ id: "a", state: "loaded", startedAtMs: 1, completedAtMs: 200, queueWaitMs: 1 }),
      row({ id: "b", state: "loading", startedAtMs: 2, completedAtMs: null, queueWaitMs: 2 }),
      row({ id: "c", state: "eligible", startedAtMs: null, completedAtMs: null, queueWaitMs: null }),
    ];
    const m = deriveOverviewMetrics(rows);
    expect(m.completionSpanMs).toBeNull();
    expect(m.allDone).toBe(false);
    expect(m.firstDispatchMs).toBe(1);
    expect(m.active).toBe(1);
    expect(m.queued).toBe(1);
    expect(m.completed).toBe(1);
    expect(m.started).toBe(2);
  });

  it("ignores resources that have not started when taking the median queue wait", () => {
    const rows = [
      row({ queueWaitMs: 8 }),
      row({ state: "eligible", startedAtMs: null, completedAtMs: null, queueWaitMs: null }),
    ];
    expect(deriveOverviewMetrics(rows).medianQueueWaitMs).toBe(8);
  });

  it("reports the latest observed timestamp across all rows", () => {
    const rows = [
      row({ eligibleAtMs: 5, startedAtMs: 9, completedAtMs: 300 }),
      row({ state: "loading", eligibleAtMs: 5, startedAtMs: 310, completedAtMs: null, queueWaitMs: 305 }),
    ];
    expect(deriveOverviewMetrics(rows).lastObservedMs).toBe(310);
  });

  it("treats errored resources as finished", () => {
    const rows = [row({ state: "error", startedAtMs: 1, completedAtMs: 50 })];
    expect(deriveOverviewMetrics(rows).allDone).toBe(true);
  });
});

describe("timeline axis helpers", () => {
  it("never shrinks the axis below the observed data", () => {
    expect(timelineScaleMs(780, 900)).toBeGreaterThan(900);
    expect(timelineScaleMs(780, 100)).toBeGreaterThan(780);
  });
  it("picks a tick step that yields at most 8 gridlines", () => {
    for (const scale of [200, 500, 800, 1700, 4000, 20000]) {
      expect(scale / niceTickStep(scale)).toBeLessThanOrEqual(8.0001);
    }
  });
});
