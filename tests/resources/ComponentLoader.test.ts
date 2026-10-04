import { describe, it, expect, vi } from "vitest";
import { createComponentLoader } from "../../src/resources/ComponentLoader";

describe("createComponentLoader", () => {
  it("memoizes the import promise across multiple calls", async () => {
    const importFn = vi.fn(() => Promise.resolve({ default: () => null }));
    const cached = createComponentLoader(importFn);

    const p1 = cached();
    const p2 = cached();

    expect(p1).toBe(p2);
    await p1;
    expect(importFn).toHaveBeenCalledTimes(1);
  });
});
