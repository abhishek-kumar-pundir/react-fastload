import { describe, it, expect } from "vitest";
import { buildTimelineRows } from "./synthetic";
import type { ResourceRecord } from "react-fastload";

function record(overrides: Partial<ResourceRecord>): ResourceRecord {
  return {
    id: "r",
    type: "other",
    priority: "NORMAL",
    state: "idle",
    strategy: "eager",
    deferred: false,
    prefetched: false,
    timestamps: { registeredAt: 0 },
    ...overrides,
  };
}

describe("buildTimelineRows", () => {
  it("converts absolute timestamps to ms-since-origin", () => {
    const rows = buildTimelineRows(
      [record({ id: "a", timestamps: { registeredAt: 1000, eligibleAt: 1000, loadStartedAt: 1010, loadEndedAt: 1200 } })],
      1000
    );
    expect(rows[0]).toMatchObject({ eligibleAtMs: 0, startedAtMs: 10, completedAtMs: 200, queueWaitMs: 10 });
  });

  it("leaves not-yet-reached timestamps as null rather than 0", () => {
    const rows = buildTimelineRows(
      [record({ id: "a", timestamps: { registeredAt: 1000, eligibleAt: 1000 } })],
      1000
    );
    expect(rows[0]!.startedAtMs).toBeNull();
    expect(rows[0]!.completedAtMs).toBeNull();
    expect(rows[0]!.queueWaitMs).toBeNull();
  });

  it("sorts rows by eligibleAtMs, earliest first", () => {
    const rows = buildTimelineRows(
      [
        record({ id: "late", timestamps: { registeredAt: 1000, eligibleAt: 1050 } }),
        record({ id: "early", timestamps: { registeredAt: 1000, eligibleAt: 1000 } }),
      ],
      1000
    );
    expect(rows.map((r) => r.id)).toEqual(["early", "late"]);
  });

  it("queueWaitMs never goes negative even with clock jitter", () => {
    // eligibleAt slightly AFTER loadStartedAt shouldn't happen in practice,
    // but if it did due to timer jitter, this must not report negative wait.
    const rows = buildTimelineRows(
      [record({ id: "a", timestamps: { registeredAt: 1000, eligibleAt: 1010, loadStartedAt: 1005 } })],
      1000
    );
    expect(rows[0]!.queueWaitMs).toBe(0);
  });
});
