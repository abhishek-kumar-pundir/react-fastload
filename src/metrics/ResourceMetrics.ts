import { supportsNavigationTiming } from "../utils/browserSupport";

export interface NavigationMetrics {
  /** Time to first byte, in ms. Null if Navigation Timing Level 2 isn't available. */
  ttfb: number | null;
  /** DOMContentLoaded timing relative to navigation start, in ms. */
  domContentLoaded: number | null;
  /** Full load event timing relative to navigation start, in ms. */
  loadEvent: number | null;
}

export interface ResourceTimingSummary {
  /** Total number of Resource Timing entries observed for this page load. */
  totalResources: number;
  /** Sum of `transferSize` across all resources, in bytes. 0 if unavailable (e.g. cross-origin without Timing-Allow-Origin). */
  totalTransferBytes: number;
  /** Slowest resource duration observed, in ms. */
  slowestResourceMs: number | null;
}

/**
 * Reads real, already-recorded browser timing data via the Navigation
 * Timing and Resource Timing APIs. This is a point-in-time snapshot, not
 * a live subscription — call it when you actually need a reading (e.g.
 * from useFastLoadMetrics on mount and on demand).
 */
export function getNavigationMetrics(): NavigationMetrics {
  if (!supportsNavigationTiming()) {
    return { ttfb: null, domContentLoaded: null, loadEvent: null };
  }

  const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  if (!nav) {
    return { ttfb: null, domContentLoaded: null, loadEvent: null };
  }

  return {
    ttfb: round(nav.responseStart - nav.startTime),
    domContentLoaded: round(nav.domContentLoadedEventEnd - nav.startTime),
    loadEvent: nav.loadEventEnd > 0 ? round(nav.loadEventEnd - nav.startTime) : null,
  };
}

export function getResourceTimingSummary(): ResourceTimingSummary {
  if (!supportsNavigationTiming()) {
    return { totalResources: 0, totalTransferBytes: 0, slowestResourceMs: null };
  }

  const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  let totalTransferBytes = 0;
  let slowest: number | null = null;

  for (const entry of entries) {
    totalTransferBytes += entry.transferSize || 0;
    const duration = entry.duration;
    if (slowest === null || duration > slowest) slowest = duration;
  }

  return {
    totalResources: entries.length,
    totalTransferBytes,
    slowestResourceMs: slowest !== null ? round(slowest) : null,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
