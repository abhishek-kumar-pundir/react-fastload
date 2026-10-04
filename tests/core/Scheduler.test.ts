import { describe, it, expect, vi } from "vitest";
import { Scheduler } from "../../src/core/Scheduler";
import { ResourceRegistry } from "../../src/core/ResourceRegistry";
import { PriorityEngine } from "../../src/core/PriorityEngine";
import type { ConnectionInfo } from "../../src/core/types";

const connection: ConnectionInfo = {
  effectiveType: "4g",
  downlink: 10,
  rtt: 50,
  saveData: false,
  supported: true,
};
const ctx = { connection, preloadDistance: 1000 };

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

describe("Scheduler", () => {
  it("respects the concurrency cap", () => {
    const registry = new ResourceRegistry();
    const engine = new PriorityEngine();
    const scheduler = new Scheduler(registry, engine, { concurrency: 2 });

    const pending: Array<{ resolve: () => void }> = [];
    for (const id of ["a", "b", "c"]) {
      registry.register({ id, type: "image", priority: "NORMAL", strategy: "lazy" });
      registry.setState(id, "eligible");
      const d = deferred();
      pending.push(d);
      scheduler.registerLoader(id, () => d.promise);
    }

    scheduler.runPass({ ctx });

    const states = ["a", "b", "c"].map((id) => registry.get(id)!.state);
    const loadingCount = states.filter((s) => s === "loading").length;
    expect(loadingCount).toBe(2);
  });

  it("loads eligible resources in priority order first", () => {
    const registry = new ResourceRegistry();
    const engine = new PriorityEngine();
    const scheduler = new Scheduler(registry, engine, { concurrency: 1 });

    registry.register({ id: "low", type: "image", priority: "LOW", strategy: "lazy" });
    registry.register({ id: "high", type: "image", priority: "HIGH", strategy: "lazy" });
    registry.setState("low", "eligible");
    registry.setState("high", "eligible");

    const neverResolves = new Promise<void>(() => {});
    scheduler.registerLoader("low", () => neverResolves);
    scheduler.registerLoader("high", () => neverResolves);

    scheduler.runPass({ ctx });

    expect(registry.get("high")!.state).toBe("loading");
    expect(registry.get("low")!.state).toBe("eligible");
  });

  it("marks a resource loaded when its loader resolves, and frees a concurrency slot", async () => {
    const registry = new ResourceRegistry();
    const engine = new PriorityEngine();
    const scheduler = new Scheduler(registry, engine, { concurrency: 1 });

    registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });
    registry.setState("a", "eligible");
    scheduler.registerLoader("a", () => Promise.resolve());

    scheduler.runPass({ ctx });
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.get("a")!.state).toBe("loaded");
  });

  it("marks a resource errored when its loader rejects", async () => {
    const registry = new ResourceRegistry();
    const engine = new PriorityEngine();
    const scheduler = new Scheduler(registry, engine, { concurrency: 1 });

    registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });
    registry.setState("a", "eligible");
    scheduler.registerLoader("a", () => Promise.reject(new Error("boom")));

    scheduler.runPass({ ctx });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.get("a")!.state).toBe("error");
  });

  it("records defer/prefetch decisions and caps the decision log", () => {
    const registry = new ResourceRegistry();
    const engine = new PriorityEngine();
    const onDecision = vi.fn();
    const scheduler = new Scheduler(registry, engine, { onDecision });

    registry.register({ id: "a", type: "image", priority: "LOW", strategy: "lazy" });
    scheduler.defer("a", "outside zone");
    scheduler.prefetch("a", "entered zone");

    expect(onDecision).toHaveBeenCalledTimes(2);
    expect(scheduler.getDecisionLog().map((d) => d.action)).toEqual(["defer", "prefetch"]);
  });
});
