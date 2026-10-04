# Performance measurement methodology

This document exists because the single most important rule in this
project is: **never present an estimate as a browser measurement, and never
hardcode a performance claim.**

## What "browser-observed" means here

`useFastLoadMetrics()` returns fields drawn from three different sources.
They are documented per-field in `src/metrics/MetricsCollector.ts`, but the
categories are:

1. **Browser-observed** — read directly from native browser APIs:
   `PerformanceObserver` (paint timing, Largest Contentful Paint,
   Cumulative Layout Shift), and the Navigation/Resource Timing APIs
   (`ttfb`, `totalResourcesObserved`, `totalTransferBytesObserved`). These
   are `null` until the browser has actually reported them — never
   defaulted to `0` or backfilled with a guess.
2. **Internal (ReactFastLoad bookkeeping)** — counters the scheduler itself
   tracks: `initialRequests`, `deferredRequests`/`deferredResources`,
   `imagesDeferred`, `videosDeferred`, `audiosDeferred`, `componentsDeferred`.
   These describe what *ReactFastLoad decided to do*, not what the browser
   measured.
3. **Estimated** — `bytesDeferred` sums each deferred resource's
   `estimatedSize`, which is whatever the developer optionally passed in
   (e.g. from a known image dimension, or — as the benchmark now does for
   its self-hosted images — the file's exact real size). If no
   `estimatedSize` was given, that resource contributes `0` — the field
   does not infer a size from file type or dimensions.

## Initial vs. Eventual: the distinction that matters most

An earlier version of the benchmark reported a single "Transferred"
number that badly misled readers: it looked like ReactFastLoad had
permanently reduced total data transferred (e.g. "1.5 MB → 9 KB"), when
what had actually happened was that the number was captured too early —
before most of the deferred resources had finished loading. The 9 KB was
correct for the moment it was measured; it was not "everything this page
will ever download."

The benchmark now reports three things separately, and so does the run
harness (`AutoRunner.tsx`) and the results table:

- **INITIAL** — everything requested up to the browser's own `load`
  event. A resource counts as Initial if its Resource Timing entry's
  `startTime <= navigationEntry.loadEventEnd`. This is a standard,
  well-defined browser lifecycle boundary, not an arbitrary timeout.
- **SCHEDULER** — ReactFastLoad's own registry bookkeeping: how many
  resources it decided to defer, and their combined `estimatedSize`.
  This reflects a *decision*, not a measurement — hence "estimated."
- **EVENTUAL** — what has actually transferred by a later checkpoint.
  The live on-page dashboard shows this as continuously-updating "so
  far" numbers (correctly labeled as such — they are not claimed to be
  final). The run harness instead waits for a **network-idle heuristic**
  (resource count unchanged for ~1.2s) or a **12-second hard cap**,
  whichever comes first, then takes one Eventual snapshot per run so
  repeated runs are comparable to each other.
- **`actuallyDeferredBytes`** — real (not estimated) bytes for deferred
  resources that had *actually finished loading* by the Eventual
  snapshot, computed by matching each deferred resource's real URL
  against its Resource Timing entry. This is never used to claim "bytes
  saved" — a deferred resource that hasn't loaded yet isn't avoided, it's
  just not loaded *yet*; see the next section.

**Neither window is a guarantee of the page's full resource lifetime.** A
resource that only loads on a user scroll or interaction that never
happens during an automated run will never appear in either snapshot —
this is a real limitation of client-only automation, not a bug, and it's
called out again in `benchmark/README.md`.

## What this benchmark is actually trying to show

Not "ReactFastLoad downloads fewer bytes" — over a long enough eventual
window, both pages request essentially the same real content, so total
bytes eventually transferred can come out *similar or even higher* for
the ReactFastLoad page (extra scheduler bookkeeping, slightly different
request timing). That is not a failure.

The actual claim is narrower and more defensible: **ReactFastLoad gets
the critical experience ready with substantially less *initial* work,
then schedules the remaining, non-critical work afterward.** The
Initial-vs-Eventual split above is designed specifically to let you see
that distinction instead of collapsing it into one misleading number.

## How to run a fair before/after comparison

The benchmark app (`/benchmark`) implements the above directly, with
self-hosted, generated image assets (see `benchmark/scripts/`) served
with plain `200` responses — an earlier version used a third-party image
host whose URLs 302-redirected before the actual image, adding noise to
the network waterfall that a clean benchmark shouldn't have.

1. Load a **Baseline** page, let it settle, then a **ReactFastLoad** page
   for the same scenario — reload rather than client-side navigate (see
   `benchmark/README.md` for why).
2. Use the **"Start N-run comparison"** control for repeated, alternating
   runs with real median/p75/p95 reported on the Results page, rather
   than a single sample.
3. Report **Initial**, **Scheduler**, and **Eventual** numbers
   separately — never collapse them into one "Transferred" figure.

No numbers are hardcoded anywhere in the benchmark; every value shown
comes from a live measurement of the page that just loaded, in the
browser running it. Results will vary by machine, connection, cache
state, and browser — that's expected.

## Known limitations of this methodology

- **LCP and CLS can still change after the reported snapshot** — both are
  defined over the page's full lifetime. The Initial snapshot's LCP/CLS
  are a reading at that point, not guaranteed-final numbers.
- **`transferSize` is `0` for opaque, no-CORS cross-origin resources**,
  which is indistinguishable from a real cache hit using the heuristic
  this benchmark uses (`transferSize === 0 && decodedBodySize > 0`).
  Cache hit/miss counts are labeled as a heuristic, not an exact reading,
  for this reason.
- **The run harness doesn't clear the HTTP cache between steps.** Later
  runs in an alternating sequence can be faster for reasons that have
  nothing to do with either page. For a fully controlled comparison, use
  a fresh private/incognito window per run, or an external tool like
  Lighthouse CI or Playwright with explicit cache control.
- **Client hardware and network conditions dominate absolute numbers.**
  Treat the deltas between Baseline and ReactFastLoad on the *same*
  machine/connection as the meaningful comparison, not the absolute
  millisecond values.
- **The scheduler's benefit scales with resource count and page weight.**
  On a page with only 2-3 images, deferring off-screen resources has very
  little measurable effect; the benchmark's Light/Heavy/Extreme scenarios
  exist specifically to test whether that scaling actually holds.
