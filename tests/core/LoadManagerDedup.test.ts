import { describe, it, expect, afterEach } from "vitest";
import { LoadManager } from "../../src/core/LoadManager";

describe("LoadManager — request deduplication (reference counting)", () => {
  let manager: LoadManager;

  afterEach(() => {
    manager?.destroy();
  });

  it("two registrations with the same id share ONE registry entry", () => {
    manager = new LoadManager();
    const a = manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });
    const b = manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });

    expect(a).toBe(b);
    expect(manager.registry.all()).toHaveLength(1);
  });

  it("unregistering while a second consumer is still mounted does NOT remove the resource", () => {
    manager = new LoadManager();
    manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });
    manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" }); // second mounted consumer

    manager.unregister("shared"); // first consumer unmounts

    expect(manager.registry.has("shared")).toBe(true);
  });

  it("the resource is only removed once the LAST consumer unregisters", () => {
    manager = new LoadManager();
    manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });
    manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });

    manager.unregister("shared");
    expect(manager.registry.has("shared")).toBe(true);

    manager.unregister("shared");
    expect(manager.registry.has("shared")).toBe(false);
  });

  it("does not go negative if unregister is called more times than register (defensive)", () => {
    manager = new LoadManager();
    manager.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });
    manager.unregister("a");
    expect(() => manager.unregister("a")).not.toThrow();
    expect(manager.registry.has("a")).toBe(false);
  });
});

describe("LoadManager — abort on last unmount", () => {
  let manager: LoadManager;

  afterEach(() => {
    manager?.destroy();
  });

  it("aborts the AbortController when the only consumer unmounts before loading finishes", () => {
    manager = new LoadManager();
    const record = manager.register({ id: "a", type: "image", priority: "NORMAL", strategy: "lazy" });
    const signal = record.abortController?.signal;

    manager.unregister("a");

    expect(signal?.aborted).toBe(true);
  });

  it("does NOT abort while a second consumer is still mounted", () => {
    manager = new LoadManager();
    const record = manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });
    manager.register({ id: "shared", type: "image", priority: "NORMAL", strategy: "lazy" });
    const signal = record.abortController?.signal;

    manager.unregister("shared"); // only one of two consumers leaves

    expect(signal?.aborted).toBe(false);
  });

  it("does NOT abort a resource that already finished loading successfully", () => {
    manager = new LoadManager();
    const record = manager.register({ id: "a", type: "image", priority: "CRITICAL", strategy: "eager" });
    manager.registry.setState("a", "loaded");
    const signal = record.abortController?.signal;

    manager.unregister("a");

    expect(signal?.aborted).toBe(false);
  });
});
