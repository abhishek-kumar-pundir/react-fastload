import { describe, it, expect, vi } from "vitest";
import { ResourceRegistry } from "../../src/core/ResourceRegistry";

describe("ResourceRegistry", () => {
  it("registers a resource with idle state and timestamps", () => {
    const registry = new ResourceRegistry();
    const record = registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });

    expect(record.state).toBe("idle");
    expect(record.deferred).toBe(false);
    expect(record.prefetched).toBe(false);
    expect(typeof record.timestamps.registeredAt).toBe("number");
  });

  it("does not overwrite an already-registered resource", () => {
    const registry = new ResourceRegistry();
    const first = registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });
    const second = registry.register({ id: "a", type: "image", priority: "HIGH", strategy: "eager" });

    expect(second).toBe(first);
    expect(registry.get("a")?.priority).toBe("NORMAL");
  });

  it("setState returns the CURRENT record reflecting the new state, not the stale pre-call object", () => {
    const registry = new ResourceRegistry();
    registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });

    const result = registry.setState("a", "eligible");
    expect(result?.state).toBe("eligible");

    // A no-op transition (already in that state) still returns the current record.
    const noop = registry.setState("a", "eligible");
    expect(noop?.state).toBe("eligible");

    // An unknown id returns undefined, not a stale/fabricated record.
    expect(registry.setState("does-not-exist", "eligible")).toBeUndefined();
  });

  it("setState stamps the right timestamp per transition", () => {
    const registry = new ResourceRegistry();
    registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });

    registry.setState("a", "eligible");
    expect(registry.get("a")?.timestamps.eligibleAt).toBeDefined();

    registry.setState("a", "loading");
    expect(registry.get("a")?.timestamps.loadStartedAt).toBeDefined();

    registry.setState("a", "loaded");
    expect(registry.get("a")?.timestamps.loadEndedAt).toBeDefined();
  });

  it("notifies subscribers on register, update, and unregister", () => {
    const registry = new ResourceRegistry();
    const listener = vi.fn();
    registry.subscribe(listener);

    registry.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });
    registry.setState("a", "eligible");
    registry.unregister("a");

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("summary() correctly aggregates deferred resources by type, including audio", () => {
    const registry = new ResourceRegistry();
    registry.register({ id: "img1", type: "image", priority: "LOW", strategy: "lazy", estimatedSize: 1000 });
    registry.register({ id: "vid1", type: "video", priority: "LOW", strategy: "lazy", estimatedSize: 5000 });
    registry.register({ id: "aud1", type: "audio", priority: "LOW", strategy: "lazy", estimatedSize: 3000 });
    registry.register({ id: "cmp1", type: "component", priority: "LOW", strategy: "lazy" });
    registry.register({ id: "img2", type: "image", priority: "CRITICAL", strategy: "eager" });

    registry.markDeferred("img1");
    registry.markDeferred("vid1");
    registry.markDeferred("aud1");
    registry.markDeferred("cmp1");

    const summary = registry.summary();
    expect(summary.deferredRequests).toBe(4);
    expect(summary.imagesDeferred).toBe(1);
    expect(summary.videosDeferred).toBe(1);
    expect(summary.audiosDeferred).toBe(1);
    expect(summary.componentsDeferred).toBe(1);
    expect(summary.bytesDeferred).toBe(9000);
    expect(summary.initialRequests).toBe(1); // img2 was never deferred
  });
});
