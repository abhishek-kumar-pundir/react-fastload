/**
 * Centralized feature-detection so the rest of the codebase never sprinkles
 * `typeof window !== "undefined"` checks everywhere, and so SSR doesn't crash.
 */

export const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export function supportsIntersectionObserver(): boolean {
  return isBrowser && typeof (window as any).IntersectionObserver === "function";
}

export function supportsPerformanceObserver(): boolean {
  return isBrowser && typeof PerformanceObserver !== "undefined";
}

export function supportsNavigationTiming(): boolean {
  return (
    isBrowser &&
    typeof performance !== "undefined" &&
    typeof performance.getEntriesByType === "function"
  );
}

export function supportsNetworkInformation(): boolean {
  return isBrowser && "connection" in navigator;
}

export function supportsRequestIdleCallback(): boolean {
  return isBrowser && "requestIdleCallback" in window;
}

/** Schedule non-urgent work using requestIdleCallback where available, falling back to a short timeout. */
export function scheduleIdle(callback: () => void, timeout = 200): void {
  if (supportsRequestIdleCallback()) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else if (isBrowser) {
    window.setTimeout(callback, 1);
  } else {
    callback();
  }
}

export function supportsFetchPriority(): boolean {
  if (!isBrowser) return false;
  const img = document.createElement("img");
  return "fetchPriority" in img;
}
