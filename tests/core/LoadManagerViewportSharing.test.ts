import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LoadManager } from "../../src/core/LoadManager";

class CountingIntersectionObserver {
  static instanceCount = 0;
  observe() {}
  unobserve() {}
  disconnect() {}
  constructor() {
    CountingIntersectionObserver.instanceCount += 1;
  }
}

describe("LoadManager — shared ViewportObserver", () => {
  const originalIO = (globalThis as any).IntersectionObserver;
  let manager: LoadManager;

  beforeEach(() => {
    CountingIntersectionObserver.instanceCount = 0;
    (globalThis as any).IntersectionObserver = CountingIntersectionObserver;
  });

  afterEach(() => {
    manager?.destroy();
    (globalThis as any).IntersectionObserver = originalIO;
  });

  it("creates exactly ONE native IntersectionObserver for the whole provider, not one per resource", () => {
    manager = new LoadManager();

    for (let i = 0; i < 20; i++) {
      manager.register({ id: `img-${i}`, type: "image", priority: "NORMAL", strategy: "lazy" });
      const el = document.createElement("div");
      manager.observeViewport(`img-${i}`, el);
    }

    expect(CountingIntersectionObserver.instanceCount).toBe(1);
  });
});
