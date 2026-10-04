import { describe, it, expect, beforeEach } from "vitest";
import { loadVideo } from "../../src/resources/VideoLoader";

describe("loadVideo", () => {
  beforeEach(() => {
    Object.defineProperty(global.Image.prototype, "src", {
      configurable: true,
      set(this: HTMLImageElement) {
        queueMicrotask(() => this.onload && (this.onload as any)(new Event("load")));
      },
    });
  });

  it("resolves immediately for LOW/NORMAL/IDLE priority without warming the poster", async () => {
    const start = Date.now();
    await loadVideo({ src: "/clip.mp4", poster: "/poster.jpg", priority: "LOW" });
    expect(Date.now() - start).toBeLessThan(20);
  });

  it("warms the poster for CRITICAL/HIGH priority", async () => {
    await expect(loadVideo({ src: "/clip.mp4", poster: "/poster.jpg", priority: "HIGH" })).resolves.toBeUndefined();
  });

  it("resolves (not rejects) when aborted mid-poster-warm-up", async () => {
    const controller = new AbortController();
    const promise = loadVideo({ src: "/clip.mp4", poster: "/poster.jpg", priority: "HIGH", signal: controller.signal });
    controller.abort();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves immediately if already aborted before starting", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadVideo({ src: "/clip.mp4", poster: "/poster.jpg", priority: "HIGH", signal: controller.signal })
    ).resolves.toBeUndefined();
  });
});
