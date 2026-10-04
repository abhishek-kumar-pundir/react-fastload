import { describe, it, expect, beforeEach } from "vitest";
import { loadImage } from "../../src/resources/ImageLoader";

describe("loadImage abort handling", () => {
  beforeEach(() => {
    // jsdom's Image never fires real network events; simulate immediate
    // success unless aborted first (tests below abort before this fires).
    Object.defineProperty(global.Image.prototype, "src", {
      configurable: true,
      set(this: HTMLImageElement) {
        queueMicrotask(() => this.onload && (this.onload as any)(new Event("load")));
      },
    });
  });

  it("rejects immediately with an AbortError if the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(loadImage({ src: "/a.jpg", priority: "NORMAL", signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects with an AbortError if aborted while in flight, and never resolves afterward", async () => {
    const controller = new AbortController();
    const promise = loadImage({ src: "/a.jpg", priority: "NORMAL", signal: controller.signal });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });

  it("resolves normally when never aborted", async () => {
    await expect(loadImage({ src: "/a.jpg", priority: "NORMAL" })).resolves.toBeDefined();
  });
});
