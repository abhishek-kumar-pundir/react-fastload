import { describe, it, expect, afterEach } from "vitest";
import { LoadManager } from "../../src/core/LoadManager";
import type { Priority } from "../../src/core/types";

/**
 * Regression tests: resources queued behind the concurrency cap must be
 * dispatched when a slot frees up, without needing an unrelated event
 * (new registration, IntersectionObserver callback) to trigger a pass.
 * Deterministic: loaders are resolved manually, no timers.
 */
function deferred() {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe("Scheduler — queued resources drain when slots free up", () => {
  let manager: LoadManager;
  afterEach(() => manager?.destroy());

  function setup(concurrency: number, priorities: Priority[]) {
    manager = new LoadManager({ concurrency });
    const gates = priorities.map(() => deferred());
    priorities.forEach((priority, i) => {
      manager.register({ id: `r${i}`, type: "other", priority, strategy: "eager" });
      manager.setLoader(`r${i}`, () => gates[i]!.promise);
    });
    return gates;
  }

  const loadOrder = () =>
    manager.scheduler
      .getDecisionLog()
      .filter((d) => d.action === "load")
      .map((d) => d.resourceId);

  it("dispatches the next queued resource after a load completes", async () => {
    const gates = setup(2, ["NORMAL", "NORMAL", "NORMAL", "NORMAL"]);
    await tick();
    expect(loadOrder()).toEqual(["r0", "r1"]);

    gates[0]!.resolve();
    await tick();
    expect(loadOrder()).toEqual(["r0", "r1", "r2"]);

    gates[1]!.resolve();
    await tick();
    expect(loadOrder()).toEqual(["r0", "r1", "r2", "r3"]);
  });

  it("never exceeds the configured concurrency while draining", async () => {
    const gates = setup(2, ["NORMAL", "NORMAL", "NORMAL", "NORMAL", "NORMAL"]);
    await tick();
    for (const gate of gates) {
      expect(manager.registry.byState("loading").length).toBeLessThanOrEqual(2);
      gate.resolve();
      await tick();
    }
    expect(manager.registry.byState("loaded")).toHaveLength(5);
  });

  it("keeps priority ordering across waves", async () => {
    // r0 NORMAL, r1 IDLE, r2 LOW, r3 HIGH; one slot. Expected dispatch:
    // HIGH (r3) -> NORMAL (r0) -> LOW (r2) -> IDLE (r1).
    const gates = setup(1, ["NORMAL", "IDLE", "LOW", "HIGH"]);
    await tick();
    expect(loadOrder()).toEqual(["r3"]);

    gates[3]!.resolve();
    await tick();
    expect(loadOrder()).toEqual(["r3", "r0"]);

    gates[0]!.resolve();
    await tick();
    expect(loadOrder()).toEqual(["r3", "r0", "r2"]);

    gates[2]!.resolve();
    await tick();
    expect(loadOrder()).toEqual(["r3", "r0", "r2", "r1"]);
  });

  it("also frees the slot when a load fails", async () => {
    const gates = setup(1, ["NORMAL", "NORMAL"]);
    await tick();
    gates[0]!.reject(new Error("boom"));
    await tick();
    expect(manager.registry.get("r0")?.state).toBe("error");
    expect(loadOrder()).toEqual(["r0", "r1"]);
  });

  it("does not dispatch anything extra when nothing is queued", async () => {
    const gates = setup(2, ["NORMAL"]);
    await tick();
    gates[0]!.resolve();
    await tick();
    expect(loadOrder()).toEqual(["r0"]);
  });
});
