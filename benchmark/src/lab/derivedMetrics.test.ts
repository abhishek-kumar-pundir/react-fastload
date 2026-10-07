import { describe, it, expect } from "vitest";
import { summarizeRuns, computeSpan, computeDedupRatio } from "./derivedMetrics";

describe("summarizeRuns", () => {
  it("computes median/min/max/mean for an odd-length array", () => {
    const stats = summarizeRuns([30, 10, 20]);
    expect(stats).toEqual({ median: 20, min: 10, max: 30, mean: 20, n: 3 });
  });

  it("averages the two middle values for an even-length array", () => {
    const stats = summarizeRuns([10, 20, 30, 40]);
    expect(stats.median).toBe(25);
    expect(stats.n).toBe(4);
  });

  it("ignores non-finite values rather than letting them corrupt the result", () => {
    const stats = summarizeRuns([10, NaN, 20, Infinity]);
    expect(stats.n).toBe(2);
    expect(stats.median).toBe(15);
  });

  it("returns all-null for an empty input rather than NaN/undefined", () => {
    expect(summarizeRuns([])).toEqual({ median: null, min: null, max: null, mean: null, n: 0 });
  });

  it("does not mutate the input array", () => {
    const input = [3, 1, 2];
    summarizeRuns(input);
    expect(input).toEqual([3, 1, 2]);
  });
});

describe("computeSpan", () => {
  it("computes first start, last completion, and the span between them", () => {
    const span = computeSpan([
      { eligibleAtMs: 0, startedAtMs: 5, completedAtMs: 50 },
      { eligibleAtMs: 2, startedAtMs: 10, completedAtMs: 120 },
    ]);
    expect(span).toEqual({ firstStartMs: 5, lastCompletionMs: 120, completionSpanMs: 115 });
  });

  it("returns null span when nothing has completed yet — never fabricates a value", () => {
    const span = computeSpan([{ eligibleAtMs: 0, startedAtMs: 5, completedAtMs: null }]);
    expect(span.lastCompletionMs).toBeNull();
    expect(span.completionSpanMs).toBeNull();
  });

  it("returns all nulls for an empty set", () => {
    expect(computeSpan([])).toEqual({ firstStartMs: null, lastCompletionMs: null, completionSpanMs: null });
  });
});

describe("computeDedupRatio", () => {
  it("computes consumers-per-real-load", () => {
    expect(computeDedupRatio(3, 1)).toBe(3);
    expect(computeDedupRatio(6, 2)).toBe(3);
  });

  it("returns null rather than Infinity/NaN when there are zero registry entries", () => {
    expect(computeDedupRatio(3, 0)).toBeNull();
  });
});
