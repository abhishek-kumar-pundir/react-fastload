# Roadmap — evaluating the "V2 architecture" proposal

A reviewer proposed evolving ReactFastLoad into a much larger runtime:
resource graphs, a real priority-queue heap, a concurrency manager,
request deduplication, HTTP range/chunked loading, progressive images,
streaming, a three-level cache (memory/Cache API/network),
predictive/background prefetch, an idle-time work scheduler, abortable
in-flight work, stale-while-revalidate, cache eviction policy, a service
worker runtime, and a devtools "flight recorder."

That's a legitimate vision for a much bigger project. It's also roughly
15-20 independent subsystems — not something to bolt onto a young library
in one pass without breaking the thing that currently works and is
tested. This document is an honest engineering triage of that list:
what's worth doing next, what's worth doing later, and what I'd push
back on or scope down.

## Audit findings, fixed

A full-codebase audit (prompted by a later review asking for exactly
this) found two further real bugs, unrelated to the roadmap above:

- **`FastLoadProvider`'s debug panel read `process.env.NODE_ENV` with no
  guard.** `process` is a Node/bundler global, not a browser one — Vite,
  webpack, and Next.js all define it for compatibility, but a consumer
  using this library via a bare ESM `<script>` with no bundler would hit
  a `ReferenceError`. Invisible in this repo's own tests because Vitest
  runs under Node, where `process` is real. Fixed with a
  `typeof process !== "undefined"` guard.
- **`LoadManager.register()` could return a stale record for CRITICAL/
  eager resources.** `ResourceRegistry.setState()` replaces the stored
  object rather than mutating it in place, but `register()` was returning
  its *pre-transition* local reference after calling `setState()` — so a
  caller reading the directly-returned record for a `CRITICAL` resource
  would see `state: "idle"` even though the registry's own state was
  already `"eligible"`. `SmartImage` itself wasn't affected (eager
  rendering bypasses the state check entirely), but any code calling
  `LoadManager.register()` directly and trusting its return value would
  be. Caught by a clean-install runtime smoke test — rendering straight
  from the packed tarball, not the local source — that asserted on the
  returned record immediately after registration. Fixed by having
  `setState()` return the current record and `register()` use that
  return value instead of its stale local variable.

## Done (shipped since this document was first written)

- **In-flight request deduplication.** `SmartImage`/`SmartVideo`/
  `SmartAudio` now default their registry id to `${type}:${src}` (no
  per-instance suffix), so two mounted instances with the same `src`
  collide into one registry entry instead of firing two independent
  loads. `LoadManager.register()`/`unregister()` are reference-counted so
  the shared entry (and its `AbortController`) is only actually torn down
  once the *last* consumer unmounts — an early unmount of one of two
  instances no longer deletes a resource the other still depends on. Pass
  an explicit `resourceId` to opt out when two elements with the same
  `src` genuinely need independent scheduling. Covered by
  `tests/core/LoadManagerDedup.test.ts`.
- **Abort work that's no longer useful.** Each registry entry now carries
  an `AbortController`; `loadImage`/`loadVideo`/`loadAudio` all accept
  and honor a `signal`, and `LoadManager` calls `.abort()` exactly when
  the last consumer of a still-in-flight (not yet loaded/errored)
  resource unregisters — never for a resource another mounted consumer
  still needs, and never for one that already finished. Covered by
  `tests/core/LoadManagerDedup.test.ts` and per-loader abort tests in
  `tests/resources/`.
- **One shared `IntersectionObserver` per provider, not one per
  resource.** An audit caught `useLazyLoad` creating its own
  `ViewportObserver` (and therefore its own native `IntersectionObserver`)
  per resource — harmless correctness-wise, but on a 50-resource page
  that's 50 separate native observers doing redundant work.
  `LoadManager` now owns exactly one, shared across every resource in the
  provider. Covered by `tests/core/LoadManagerViewportSharing.test.ts`.

## Do next (real value, contained scope, fits the current architecture)

- **Network-aware concurrency**, not just network-aware priority. The
  scheduler already deprioritizes `LOW`/`IDLE` resources on a constrained
  connection (`PriorityEngine.isConstrainedConnection`) but doesn't change
  `Scheduler`'s concurrency cap itself. Scaling concurrency down (e.g.
  4 → 2 → 1) on `effectiveType`/`saveData` changes is a small, well-scoped
  addition to `LoadManager`'s existing connection subscription. Not done
  yet — flagged here rather than silently skipped.

## Worth doing, but bigger — needs its own design pass

- **Progressive image preview (blur-up).** `<SmartImage preview="/tiny.jpg" progressive />`
  is genuinely more useful than a static `placeholder`, but touches the
  rendering/crossfade logic and needs its own tests and a11y review, not
  a quick add.
- **Stale-while-revalidate for data**, as a `useFastLoadQuery`-style hook.
  This is a different problem domain (data fetching/caching) from
  resource *loading* scheduling — closer to what React Query/SWR already
  do well. If this is wanted, I'd scope it as a thin adapter that plugs
  ReactFastLoad's priority/viewport signals into an existing data-fetching
  library rather than reimplementing caching, retries, and invalidation
  from scratch.
- **Intent/viewport-based route prefetch** (`<FastLink prefetch="intent">`).
  Reasonable and popular (Next.js does this), but it's routing-layer
  functionality, which this library currently has zero opinions about.
  Doable as a separate, optional entry point once the core scheduler is
  stable.

## Where I'd push back or descope

- **HTTP range/chunked "partial" loading of arbitrary resources.** Only
  works when the server sends `Accept-Ranges: bytes`, and for images
  specifically, "give me the middle 500KB of a JPEG" isn't generally a
  coherent operation — decoders need the whole stream or a specifically
  encoded progressive format. The honest version of this feature is
  "support progressive JPEG/AVIF and resumable video via Range," which is
  much narrower than the pitch, and largely something `<video preload>` +
  the browser already do for you. I'd rather document that clearly (as
  this repo already does) than build a half-working generic chunking
  layer that oversells what it can do.
- **Full resource *dependency graph*** (`dependencies`/`dependents` per
  node, "don't load chart.js until dashboard.js is ready"). Elegant on a
  whiteboard, but React's own component tree and `import()` graph already
  encode most real dependency relationships — a component that needs
  `dashboard.js` naturally only renders `chart.js`'s consumer after it.
  A parallel, hand-maintained dependency graph is a second source of
  truth that can drift from the real one. I'd want a concrete case this
  solves that component composition doesn't, before building it.
- **Service worker runtime as a core feature.** This is a genuine
  architecture change (network interception, offline behavior, cache
  versioning, install/activate lifecycle) with its own large surface area
  and footguns (stale deploys, cache poisoning). It's also well-served by
  existing, mature tools (Workbox). I'd keep ReactFastLoad's core promise
  — client-side scheduling of what a mounted React tree requests — and
  treat service-worker integration as, at most, a separate optional
  package that composes with Workbox rather than reimplementing it.
- **Predictive prefetch from a learned navigation-history model.** Real
  product value (Guess.js, Quicklink-style tools exist for this reason),
  but it's a different kind of project — telemetry collection, a
  probability model, a privacy story — bolted onto what's currently a
  synchronous, stateless-between-sessions scheduler. Worth a clearly
  separate package if pursued, not a quiet addition to core.
- **A full binary-heap priority queue.** The current approach — score
  every eligible resource, sort, take the top N — is O(n log n) per
  scheduling pass. For a page with dozens to low hundreds of registered
  resources (the realistic range for a browser tab), that's not a
  measured bottleneck, and a heap adds real implementation complexity
  (score changes require heap position updates, not just a re-sort) for
  a performance win that only matters at a resource count this library
  isn't targeting. I'd revisit this only if profiling on a real heavy
  page actually shows scheduling overhead.

## What I'd want before committing to any of this

Per the benchmark feedback in the same review: build the Light/Heavy/
Extreme scenario benchmark first (done — see `/benchmark`), get real
median/p75/p95 numbers, and let *that* tell us which of the above would
actually move the needle, rather than adding subsystems speculatively.
"Request dedup" and "abortable in-flight loads" are cheap to build and
almost certainly help; several of the others are expensive to build and
their real-world payoff is currently a guess.
