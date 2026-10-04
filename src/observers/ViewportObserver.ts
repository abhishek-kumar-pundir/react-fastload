import { supportsIntersectionObserver } from "../utils/browserSupport";

export type ViewportCallback = (distance: number, isIntersecting: boolean) => void;

/**
 * Thin, testable wrapper around IntersectionObserver.
 *
 * Rather than only exposing a boolean "is it visible", this computes an
 * approximate pixel distance from the viewport so the PriorityEngine can
 * rank near-viewport resources ahead of far-off ones, and so `rootMargin`
 * (the preload distance) can be configured per observer instance.
 *
 * Falls back to reporting elements as immediately eligible when
 * IntersectionObserver isn't supported (very old browsers, some SSR/test
 * environments) — a graceful degrade rather than a crash, per the
 * "progressive enhancement" requirement.
 */
export class ViewportObserver {
  private observer?: IntersectionObserver;
  private callbacks = new Map<Element, ViewportCallback>();
  private preloadDistance: number;

  constructor(preloadDistance = 1000) {
    this.preloadDistance = preloadDistance;

    if (supportsIntersectionObserver()) {
      this.observer = new IntersectionObserver(
        (entries) => this.handleEntries(entries),
        {
          root: null,
          rootMargin: `${preloadDistance}px`,
          threshold: [0, 0.01, 0.5, 1],
        }
      );
    }
  }

  observe(element: Element, callback: ViewportCallback): void {
    this.callbacks.set(element, callback);

    if (!this.observer) {
      // No IntersectionObserver support: treat everything as already in range
      // rather than never loading it at all.
      callback(0, true);
      return;
    }

    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    this.callbacks.delete(element);
    this.observer?.unobserve(element);
  }

  disconnect(): void {
    this.observer?.disconnect();
    this.callbacks.clear();
  }

  private handleEntries(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      const callback = this.callbacks.get(entry.target);
      if (!callback) continue;

      const distance = estimateDistance(entry);
      callback(distance, entry.isIntersecting);
    }
  }
}

/**
 * Approximates the pixel distance between the viewport (its expanded
 * rootMargin box, since that's what IntersectionObserver measured against)
 * and the target element. When intersecting, distance is 0 or negative.
 */
function estimateDistance(entry: IntersectionObserverEntry): number {
  if (entry.isIntersecting) return 0;

  const target = entry.boundingClientRect;
  const root = entry.rootBounds;

  if (!root) {
    // No rootBounds (e.g. root is not attached / some test doubles) — we
    // can't compute a real distance, so report "far away" rather than guessing.
    return Number.POSITIVE_INFINITY;
  }

  if (target.bottom < root.top) return root.top - target.bottom;
  if (target.top > root.bottom) return target.top - root.bottom;
  if (target.right < root.left) return root.left - target.right;
  if (target.left > root.right) return target.left - root.right;
  return 0;
}
