import { describe, it, expect, afterEach } from "vitest";
import { LoadManager } from "../../src/core/LoadManager";

describe("LoadManager", () => {
  let manager: LoadManager;

  afterEach(() => {
    manager?.destroy();
  });

  it("makes CRITICAL and eager resources immediately eligible", () => {
    manager = new LoadManager();
    manager.register({ id: "hero", type: "image", priority: "CRITICAL", strategy: "eager" });
    expect(manager.registry.get("hero")!.state).toBe("eligible");
  });

  it("register()'s RETURNED record reflects the eligible state immediately — not a stale pre-transition snapshot", () => {
    // Regression test for a real bug caught by a clean-install runtime
    // smoke test: registry.setState() replaces the stored object rather
    // than mutating it in place, so LoadManager.register() was returning
    // the pre-update object (state: "idle") for CRITICAL/eager resources,
    // even though the registry's own state was correctly "eligible".
    // Any caller reading the DIRECT return value of register() — rather
    // than re-querying the registry afterward — saw the stale state.
    manager = new LoadManager();
    const record = manager.register({ id: "hero", type: "image", priority: "CRITICAL", strategy: "eager" });
    expect(record.state).toBe("eligible");
  });

  it("keeps lazy resources idle until they enter the preload zone", () => {
    manager = new LoadManager({ preloadDistance: 500 });
    manager.register({ id: "card", type: "image", priority: "NORMAL", strategy: "lazy" });
    expect(manager.registry.get("card")!.state).toBe("idle");

    manager.reportViewportDistance("card", 2000);
    expect(manager.registry.get("card")!.state).toBe("idle");
    expect(manager.registry.get("card")!.deferred).toBe(true);

    manager.reportViewportDistance("card", 100);
    expect(manager.registry.get("card")!.state).toBe("eligible");
  });

  it("marks resources prefetched when they enter the zone ahead of intersection", () => {
    manager = new LoadManager({ preloadDistance: 1000 });
    manager.register({ id: "card", type: "image", priority: "NORMAL", strategy: "lazy" });
    manager.reportViewportDistance("card", 400); // within zone, not yet intersecting
    expect(manager.registry.get("card")!.prefetched).toBe(true);
  });

  it("actually loads a resource once a loader is set and it's eligible", async () => {
    manager = new LoadManager();
    manager.register({ id: "a", type: "image", priority: "CRITICAL", strategy: "eager" });
    manager.setLoader("a", () => Promise.resolve());

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(manager.registry.get("a")!.state).toBe("loaded");
  });
});
