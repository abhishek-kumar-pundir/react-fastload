import type { Priority } from "../core/types";

export interface VideoLoadOptions {
  src: string;
  poster?: string;
  priority: Priority;
  /** When aborted, cancels the poster warm-up (if any) and resolves immediately rather than rejecting — an aborted poster fetch shouldn't be treated as a load failure, since the real video never started downloading anyway. */
  signal?: AbortSignal;
}

/**
 * "Loading" a video, in ReactFastLoad's sense, means becoming eligible for
 * its <video> element to be mounted with a real `src`/`preload` attribute —
 * we deliberately do NOT fetch the full video file ourselves (that would
 * duplicate the browser's own byte-range/streaming behavior and could
 * download data unnecessarily, which the spec explicitly warns against).
 *
 * Instead, for CRITICAL/HIGH priority video we optionally warm the poster
 * image only, which is cheap and improves perceived load without pulling
 * video bytes. For lower priority we resolve immediately and let
 * SmartVideo mount `preload="none"` until the user interacts or the
 * element is in view.
 */
export function loadVideo(options: VideoLoadOptions): Promise<void> {
  return new Promise((resolve) => {
    if (options.signal?.aborted) {
      resolve();
      return;
    }

    if (options.poster && (options.priority === "CRITICAL" || options.priority === "HIGH")) {
      if (typeof Image === "undefined") {
        resolve();
        return;
      }
      const img = new Image();

      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
        options.signal?.removeEventListener("abort", onAbort);
      };
      const onAbort = () => {
        cleanup();
        img.src = "";
        resolve(); // not an error — the real video never started downloading
      };

      img.onload = () => {
        cleanup();
        resolve();
      };
      img.onerror = () => {
        cleanup();
        resolve(); // poster failing shouldn't block video eligibility
      };

      options.signal?.addEventListener("abort", onAbort, { once: true });
      img.src = options.poster;
      return;
    }
    resolve();
  });
}
