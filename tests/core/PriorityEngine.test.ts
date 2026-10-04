import { describe, it, expect } from "vitest";
import { PriorityEngine } from "../../src/core/PriorityEngine";
import { ResourceRegistry } from "../../src/core/ResourceRegistry";
import type { ConnectionInfo } from "../../src/core/types";

const fastConnection: ConnectionInfo = {
  effectiveType: "4g",
  downlink: 10,
  rtt: 50,
  saveData: false,
  supported: true,
};

const slowConnection: ConnectionInfo = {
  effectiveType: "2g",
  downlink: 0.4,
  rtt: 600,
  saveData: false,
  supported: true,
};

describe("PriorityEngine", () => {
  it("always ranks CRITICAL first regardless of distance", () => {
    const engine = new PriorityEngine();
    const registry = new ResourceRegistry();
    const critical = registry.register({ id: "c", type: "image", priority: "CRITICAL", strategy: "eager" });
    const high = registry.register({ id: "h", type: "image", priority: "HIGH", strategy: "lazy" });
    registry.setViewportDistance("h", 0);

    const ctx = { connection: fastConnection, preloadDistance: 1000 };
    expect(engine.compare(critical, high, ctx)).toBeLessThan(0);
  });

  it("orders same-priority resources by viewport distance", () => {
    const engine = new PriorityEngine();
    const registry = new ResourceRegistry();
    const near = registry.register({ id: "near", type: "image", priority: "NORMAL", strategy: "lazy" });
    const far = registry.register({ id: "far", type: "image", priority: "NORMAL", strategy: "lazy" });
    registry.setViewportDistance("near", 50);
    registry.setViewportDistance("far", 900);

    const ctx = { connection: fastConnection, preloadDistance: 1000 };
    expect(engine.compare(registry.get("near")!, registry.get("far")!, ctx)).toBeLessThan(0);
  });

  it("pushes LOW/IDLE priority further back on constrained connections", () => {
    const engine = new PriorityEngine();
    const registry = new ResourceRegistry();
    const low = registry.register({ id: "low", type: "image", priority: "LOW", strategy: "lazy" });
    registry.setViewportDistance("low", 0);

    const fastScore = engine.score(registry.get("low")!, { connection: fastConnection, preloadDistance: 1000 });
    const slowScore = engine.score(registry.get("low")!, { connection: slowConnection, preloadDistance: 1000 });

    expect(slowScore).toBeGreaterThan(fastScore);
  });

  it("isWithinPreloadZone respects the configured distance", () => {
    const engine = new PriorityEngine();
    expect(engine.isWithinPreloadZone(500, 1000)).toBe(true);
    expect(engine.isWithinPreloadZone(1500, 1000)).toBe(false);
    expect(engine.isWithinPreloadZone(undefined, 1000)).toBe(false);
  });

  it("treats saveData as a constrained connection even on a fast effectiveType", () => {
    const engine = new PriorityEngine();
    expect(engine.isConstrainedConnection({ ...fastConnection, saveData: true })).toBe(true);
  });
});
