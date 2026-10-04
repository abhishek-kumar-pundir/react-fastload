import { describe, it, expect, beforeEach } from "vitest";
import { loadAudio } from "../../src/resources/AudioLoader";

describe("loadAudio", () => {
  beforeEach(() => {
    // jsdom's Audio never fires real media events; simulate immediate
    // "metadata loaded" so we can assert on timing/behavior, not on
    // actual audio decoding (which no test environment can do).
    Object.defineProperty(global.Audio.prototype, "src", {
      configurable: true,
      set(this: HTMLAudioElement) {
        queueMicrotask(() => this.dispatchEvent(new Event("loadedmetadata")));
      },
    });
  });

  it("resolves immediately for NORMAL/LOW/IDLE priority without touching the network", async () => {
    const start = Date.now();
    await loadAudio({ src: "/song.mp3", priority: "NORMAL" });
    expect(Date.now() - start).toBeLessThan(20);
  });

  it("waits for metadata for CRITICAL/HIGH priority", async () => {
    await expect(loadAudio({ src: "/song.mp3", priority: "HIGH" })).resolves.toBeUndefined();
  });

  it("resolves (not rejects) when aborted before metadata finishes — an aborted probe isn't a load failure", async () => {
    const controller = new AbortController();
    const promise = loadAudio({ src: "/song.mp3", priority: "HIGH", signal: controller.signal });
    controller.abort();
    await expect(promise).resolves.toBeUndefined();
  });

  it("resolves immediately if already aborted before starting", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(loadAudio({ src: "/song.mp3", priority: "HIGH", signal: controller.signal })).resolves.toBeUndefined();
  });
});
