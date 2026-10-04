/**
 * Shared, low-level metric readers used by both pages and the run harness.
 *
 * Measurement window definitions (per docs/METHODOLOGY.md):
 *
 * - "INITIAL" = the browser's own `load` event. A resource counts toward
 *   Initial if its Resource Timing entry's startTime is <= the
 *   navigation entry's loadEventEnd. This is a well-defined, standard
 *   browser lifecycle boundary — not an arbitrary timeout.
 * - "EVENTUAL" = whatever has been observed by the time you read it. The
 *   live dashboard labels this "so far" and keeps updating; the run
 *   harness (AutoRunner) instead waits for a network-idle heuristic
 *   (resource count unchanged for ~1.2s) or a 12s hard cap, then takes
 *   ONE eventual snapshot, so repeated runs are comparable to each other.
 *   Neither is a guarantee of the page's full resource lifetime — a
 *   resource that only loads on user scroll/interaction that never
 *   happens during an automated run will never appear in either window.
 */

export interface ResourceSnapshot {
  requests: number;
  transferredBytes: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface Vitals {
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  ttfb: number | null;
}

export function readAllResourceEntries(): PerformanceResourceTiming[] {
  return performance.getEntriesByType("resource") as PerformanceResourceTiming[];
}

export function getLoadEventEnd(): number {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  return nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : Infinity;
}

export function entriesBeforeLoad(entries: PerformanceResourceTiming[]): PerformanceResourceTiming[] {
  const loadEnd = getLoadEventEnd();
  return entries.filter((e) => e.startTime <= loadEnd);
}

/**
 * Cache heuristic: `transferSize === 0` with a nonzero decoded body
 * usually means the browser served this from its own cache (disk/memory)
 * without a network transfer. NOT 100% reliable — some cross-origin
 * opaque responses also report `transferSize: 0` with no
 * `Timing-Allow-Origin` header, which this heuristic can't distinguish
 * from a real cache hit. Treat these counts as indicative, not exact.
 */
export function summarizeEntries(entries: PerformanceResourceTiming[]): ResourceSnapshot {
  let transferredBytes = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  for (const e of entries) {
    transferredBytes += e.transferSize || 0;
    if (e.transferSize === 0 && e.decodedBodySize > 0) cacheHits += 1;
    else cacheMisses += 1;
  }
  return { requests: entries.length, transferredBytes, cacheHits, cacheMisses };
}

export function readVitals(): Vitals {
  const paintEntries = performance.getEntriesByType("paint");
  const fcpEntry = paintEntries.find((e) => e.name === "first-contentful-paint");
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  const lcp = (window as any).__benchmarkLCP ?? null;
  const cls = (window as any).__benchmarkCLS ?? null;

  return {
    fcp: fcpEntry ? Math.round(fcpEntry.startTime) : null,
    lcp: lcp !== null ? Math.round(lcp) : null,
    cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,
    ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : null,
  };
}

function resolveUrl(src: string): string {
  try {
    return new URL(src, window.location.href).href;
  } catch {
    return src;
  }
}

/**
 * Real (not estimated) bytes for deferred resources that have actually
 * finished loading by the time this is called — matched by absolute URL
 * against the developer-supplied `src` each Smart* component stores in
 * its registry `meta`. Resources not yet loaded (e.g. never scrolled to)
 * are simply not counted — this never falls back to the estimate, so a
 * non-null result here is a real measurement, not a guess.
 */
export function computeActuallyDeferredBytes(
  deferredSrcs: string[],
  entries: PerformanceResourceTiming[]
): { bytes: number; matchedCount: number } | null {
  if (deferredSrcs.length === 0) return null;
  const resolved = new Set(deferredSrcs.map(resolveUrl));
  let bytes = 0;
  let matchedCount = 0;
  for (const e of entries) {
    if (resolved.has(e.name)) {
      bytes += e.transferSize || 0;
      matchedCount += 1;
    }
  }
  return matchedCount > 0 ? { bytes, matchedCount } : null;
}

/**
 * Waits for the network-idle heuristic described above, or a hard cap,
 * whichever comes first. Used only by the run harness (AutoRunner) —
 * the live on-page dashboard doesn't block on this, it just shows
 * continuously-updating "so far" numbers.
 */
export function waitForNetworkIdle(opts: { idleMs?: number; maxWaitMs?: number; pollMs?: number } = {}): Promise<void> {
  const idleMs = opts.idleMs ?? 1200;
  const maxWaitMs = opts.maxWaitMs ?? 12000;
  const pollMs = opts.pollMs ?? 400;

  return new Promise((resolve) => {
    const start = performance.now();
    let lastCount = readAllResourceEntries().length;
    let stableSince = performance.now();

    const tick = () => {
      const now = performance.now();
      const count = readAllResourceEntries().length;

      if (count !== lastCount) {
        lastCount = count;
        stableSince = now;
      }

      if (now - stableSince >= idleMs || now - start >= maxWaitMs) {
        resolve();
        return;
      }
      setTimeout(tick, pollMs);
    };

    setTimeout(tick, pollMs);
  });
}
