/** Small timing helpers shared by the resource loaders. */

export function nowMs(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

/**
 * Resolves once the browser reports it is idle (via requestIdleCallback),
 * or after `timeout` ms, whichever comes first. Falls back to a macrotask
 * when requestIdleCallback isn't available (e.g. Safari, older browsers).
 */
export function whenIdle(timeout = 200): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      (window as any).requestIdleCallback(() => resolve(), { timeout });
    } else if (typeof setTimeout !== "undefined") {
      setTimeout(resolve, 0);
    } else {
      resolve();
    }
  });
}

/** Debounce helper used by observers to coalesce rapid-fire callbacks (e.g. resize/scroll-driven intersection updates). */
export function debounce<Args extends unknown[]>(
  fn: (...args: Args) => void,
  delayMs: number
): (...args: Args) => void {
  let handle: ReturnType<typeof setTimeout> | undefined;
  return (...args: Args) => {
    if (handle) clearTimeout(handle);
    handle = setTimeout(() => fn(...args), delayMs);
  };
}
