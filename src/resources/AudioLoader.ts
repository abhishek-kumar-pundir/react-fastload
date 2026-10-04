import type { Priority } from "../core/types";

export interface AudioLoadOptions {
  src: string;
  priority: Priority;
  /** When aborted, cancels the metadata warm-up (if any) and resolves immediately. */
  signal?: AbortSignal;
}

/**
 * Mirrors VideoLoader's philosophy: we do not fetch the audio file
 * ourselves. For CRITICAL/HIGH priority we warm up just the metadata
 * (duration, seekability) via a detached <audio> element with
 * `preload="metadata"`, which is a small request compared to the full
 * file. For lower priority we resolve immediately and let SmartAudio
 * mount `preload="none"` until the resource is eligible or the user
 * interacts — the browser's own streaming/range-request behavior takes
 * over once a real <audio> element with a src is mounted.
 */
export function loadAudio(options: AudioLoadOptions): Promise<void> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve();
      return;
    }

    if (options.priority !== "CRITICAL" && options.priority !== "HIGH") {
      resolve();
      return;
    }

    if (typeof Audio === "undefined") {
      resolve();
      return;
    }

    const audio = new Audio();
    audio.preload = "metadata";

    const cleanup = () => {
      audio.removeEventListener("loadedmetadata", finish);
      audio.removeEventListener("error", finish);
      options.signal?.removeEventListener("abort", onAbort);
    };
    const finish = () => {
      cleanup();
      resolve();
    };
    const onAbort = () => {
      cleanup();
      audio.src = "";
      resolve();
    };

    audio.addEventListener("loadedmetadata", finish, { once: true });
    audio.addEventListener("error", finish, { once: true }); // metadata failing shouldn't block eligibility
    options.signal?.addEventListener("abort", onAbort, { once: true });
    audio.src = options.src;
  });
}
