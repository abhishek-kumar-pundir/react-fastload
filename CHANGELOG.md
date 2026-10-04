# Changelog

This project has not been published yet. This file starts at the first
real release rather than backfilling a history that doesn't exist.

## 0.1.0 — Initial release (unpublished)

Pre-1.0: the public API is expected to be broadly stable but may still
shift based on real-world feedback before a 1.0.0.

### Added

- **Core scheduler**: `ResourceRegistry`, `PriorityEngine`, `Scheduler`,
  `LoadManager` — a shared, priority-aware, concurrency-capped scheduler
  coordinating images, video, audio, and dynamically-imported components
  through one registry instead of each resource type solving loading
  independently.
- **Components**: `<FastLoadProvider>`, `<SmartImage>`, `<SmartVideo>`,
  `<SmartAudio>`, `lazyComponent()`.
- **Hooks**: `useLazyLoad`, `usePriority`, `useFastLoadMetrics`,
  `useFastLoadContext`.
- **Metrics**: real `PerformanceObserver`/Navigation/Resource Timing
  reads (FCP, LCP, CLS, TTFB, transfer bytes), kept strictly separate
  from ReactFastLoad's own internal registry bookkeeping — see
  `docs/METHODOLOGY.md`.
- **Request deduplication**: `SmartImage`/`SmartVideo`/`SmartAudio`
  default their resource id to `${type}:${src}`, so two components
  rendering the same resource share one load. `LoadManager` reference-
  counts registration so the shared entry isn't torn down until every
  consumer has unmounted.
- **Abort on unmount**: each resource gets an `AbortController`; an
  in-flight, not-yet-finished resource is aborted once its last consumer
  unmounts (never one still needed by another mounted consumer, and
  never one that already finished).
- **Debug panel**: `<FastLoadProvider debug>` renders every registered
  resource's state and the scheduler's recent load/defer/prefetch
  decisions with reasons.
- **Benchmark app** (`/benchmark`, not published as part of the npm
  package): Light/Heavy/Extreme scenarios, a three-part Initial/
  Scheduler/Eventual dashboard, a repeated-run harness reporting median/
  p75/p95, and self-hosted generated test assets (no third-party image
  host, no redirects).

### Fixed (found during a full-codebase audit before this release)

- `FastLoadProvider`'s debug panel accessed `process.env.NODE_ENV` with
  no guard, which would throw in a bundler-free browser environment.
- Each resource was creating its own `IntersectionObserver` instead of
  sharing one per provider — wasteful at scale (a 50-resource page
  created 50 native observers).
- `LoadManager.register()` could return a stale pre-transition record
  for `CRITICAL`/eager resources, caused by `ResourceRegistry.setState()`
  replacing rather than mutating the stored object. Caught by a
  clean-install runtime smoke test against the packed tarball, not just
  the local source.

### Known limitations

See `README.md`'s Limitations section and `docs/ROADMAP.md` for the full
list, including what was deliberately scoped out (a full resource state
machine, a binary-heap scheduler, a persistent cache layer, service-worker
integration, predictive prefetch) and why.
