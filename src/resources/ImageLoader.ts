import { supportsFetchPriority } from "../utils/browserSupport";
import type { Priority } from "../core/types";

export interface ImageLoadOptions {
  src: string;
  priority: Priority;
  decoding?: "async" | "sync" | "auto";
  /** When provided and aborted, cancels the in-flight load (clears handlers and the image src) and rejects with an AbortError, rather than letting an unmounted/irrelevant image keep downloading. */
  signal?: AbortSignal;
}

const PRIORITY_TO_FETCH_PRIORITY: Record<Priority, "high" | "low" | "auto"> = {
  CRITICAL: "high",
  HIGH: "high",
  NORMAL: "auto",
  LOW: "low",
  IDLE: "low",
};

/**
 * Loads an image using a detached HTMLImageElement so the scheduler can
 * know exactly when the browser has actually decoded it, independent of
 * whether/when the real <img> gets mounted into the DOM. This lets
 * SmartImage mount its <img> only once loading is scheduled, which is
 * what actually defers the network request — the detached-image trick
 * here is just how we observe completion, not how we cause the delay.
 */
export function loadImage(options: ImageLoadOptions): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      // SSR / non-DOM environment: nothing to load, resolve immediately.
      resolve({} as HTMLImageElement);
      return;
    }

    if (options.signal?.aborted) {
      reject(new DOMException("Image load aborted before it started", "AbortError"));
      return;
    }

    const img = new Image();

    if (supportsFetchPriority()) {
      (img as HTMLImageElement & { fetchPriority?: string }).fetchPriority =
        PRIORITY_TO_FETCH_PRIORITY[options.priority];
    }
    img.decoding = options.decoding ?? "async";

    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
      options.signal?.removeEventListener("abort", onAbort);
    };

    const onAbort = () => {
      cleanup();
      // Clearing src is the standard trick to actually cancel an in-flight
      // <img> network request — setting it to empty string, not removing
      // the attribute, is what stops the browser from continuing to fetch.
      img.src = "";
      reject(new DOMException("Image load aborted", "AbortError"));
    };

    img.onload = () => {
      cleanup();
      resolve(img);
    };
    img.onerror = (event) => {
      cleanup();
      reject(event instanceof Event ? new Error("Image failed to load") : event);
    };

    options.signal?.addEventListener("abort", onAbort, { once: true });
    img.src = options.src;
  });
}
