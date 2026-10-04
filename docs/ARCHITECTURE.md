# Architecture

ReactFastLoad's central idea is a **scheduler**, not a collection of lazy-loading
wrappers. `SmartImage`, `SmartVideo`, and `lazyComponent` are thin adapters
around one shared pipeline:

```
Resource
   |
Registry            (ResourceRegistry) — bookkeeping: id, type, priority, state
   |
Priority Engine      (PriorityEngine)   — turns priority + signals into a score
   |
Viewport / Network / User signals   (ViewportObserver, NetworkObserver)
   |
Scheduler            (Scheduler)       — picks eligible resources within a
   |                                     concurrency cap, in score order
Loading decision
   |
Browser resource      (ImageLoader / VideoLoader / ComponentLoader)
   |
Metrics               (MetricsCollector, WebVitals, ResourceMetrics)
```

## Registry (`core/ResourceRegistry.ts`)

The single source of truth for every resource ReactFastLoad knows about. It
stores a `ResourceRecord` per resource (id, type, priority, state, viewport
distance, timestamps, deferred/prefetched flags, and an `AbortController`)
and notifies subscribers on every change. It makes no loading decisions
itself.

`register()` is a no-op if the id already exists — two consumers that
resolve to the same id (by default, `SmartImage`/`SmartVideo`/`SmartAudio`
use `${type}:${src}`) share one entry rather than each creating their own.
This is request deduplication: identical resources only load once,
regardless of how many components render them. `LoadManager` layers
reference counting on top of this so the shared entry (and its
`AbortController`) is only torn down once every consumer has unmounted —
see the LoadManager section below.

## Priority Engine (`core/PriorityEngine.ts`)

Converts a resource's *declared* priority (`CRITICAL` / `HIGH` / `NORMAL` /
`LOW` / `IDLE`) plus live signals (viewport distance, connection quality)
into an *effective* score used purely for ordering. `CRITICAL` always sorts
first — the engine never demotes a resource the developer explicitly marked
critical, regardless of network conditions.

## Scheduler (`core/Scheduler.ts`)

Given the registry's `eligible` resources and their priority scores, the
scheduler dispatches loaders up to a configurable `concurrency` limit, so
(for example) a burst of five `LOW`-priority images entering the viewport at
once doesn't compete on the network with an already-loading `HIGH`-priority
one. It logs every decision it makes (`load` / `defer` / `prefetch`) with a
reason string, which powers the debug panel.

## LoadManager (`core/LoadManager.ts`)

The object `FastLoadProvider` creates once per subtree. It owns the
registry, priority engine, scheduler, and a single shared
`ViewportObserver`, and is the only thing resource wrappers and hooks
talk to — none of them touch the registry, scheduler, or observer
directly. This keeps the internals free to change without breaking the
public component/hook API.

Two behaviors live here specifically because they span multiple mounted
components, which the registry alone can't reason about:

- **Reference-counted register/unregister.** Two components resolving to
  the same resource id each bump a ref count on register and decrement it
  on unregister; the entry (and its `AbortController`) is only actually
  removed, and only actually aborted, when the count reaches zero —
  guarding against one instance's unmount deleting a resource a sibling
  instance still depends on.
- **Abort on last unmount, never on a resource another consumer still
  needs or one that already finished.** `unregister()` checks the
  resource's state before aborting: a `loaded` or already-`error`d
  resource is left alone (aborting it would be meaningless at best), and
  a resource still backed by another mounted consumer is left alone
  (aborting it would break that consumer). Only a genuinely abandoned,
  still in-flight resource gets `.abort()` called on it.

## Observers

- **ViewportObserver** wraps `IntersectionObserver` and additionally
  estimates a *distance* (not just a boolean) from the viewport, so the
  priority engine can rank near-viewport resources ahead of far-off ones,
  and so `preloadDistance` can express "start loading N px before this
  enters view." Falls back to reporting immediate eligibility when
  `IntersectionObserver` isn't supported, rather than never loading the
  resource. `LoadManager` creates exactly ONE of these per provider,
  shared across every resource — not one per resource, which an earlier
  version did and which meant a 50-resource page created 50 redundant
  native `IntersectionObserver` instances.
- **NetworkObserver** wraps the Network Information API (`navigator.connection`)
  where available. Every field is `null`/`false` when unsupported — the
  engine never assumes a fast connection in the absence of data.
- **PerformanceObserver** (`observers/PerformanceObserver.ts`) is a thin,
  defensive wrapper around the native `PerformanceObserver` used by the
  metrics layer; unsupported `entryType`s are silently skipped.

## Resource loaders

All three media loaders (Image/Video/Audio) accept an optional
`AbortSignal`. If the resource is aborted before it starts, they resolve
or reject immediately without touching the network; if aborted mid-flight,
they clear their element's `src` (the actual mechanism that cancels an
in-flight `<img>`/`<audio>` request) and clean up their event listeners.
`ComponentLoader`'s dynamic `import()` is the one exception — there is no
browser API to cancel an in-flight module fetch, so an aborted
`lazyComponent` simply lets the import finish in the background; this is
a real, documented limitation, not an oversight.

- **ImageLoader** loads via a detached `Image()` so the scheduler can know
  exactly when decoding finished, independent of whether the real `<img>`
  is mounted yet.
- **VideoLoader** never downloads video bytes itself. For `CRITICAL`/`HIGH`
  priority it optionally warms the poster image only; otherwise it resolves
  immediately and lets the real `<video preload="none">` element handle
  the rest once mounted, which is when the browser's own streaming/
  range-request behavior takes over.
- **AudioLoader** follows the same philosophy for songs/podcasts: never
  fetches audio bytes itself. For `CRITICAL`/`HIGH` priority it warms only
  the metadata (`preload="metadata"` on a detached `<audio>`); otherwise
  it resolves immediately and defers to the real `<audio>` element once
  mounted.
- **ComponentLoader** memoizes a dynamic `import()` so the scheduler
  triggering "load" more than once can't cause duplicate network requests.

## Why this isn't "just wrappers"

`React.lazy` and native `loading="lazy"` each solve one piece of this in
isolation, with no shared concept of priority or of a global concurrency
budget. ReactFastLoad's contribution is coordinating *all* resource types
(images, video, audio, components) through one scheduler that:

1. Never delays a resource explicitly marked `CRITICAL`.
2. Orders everything else by a combination of priority, proximity to the
   viewport, and current network conditions.
3. Caps how many resources load concurrently, so low-priority resources
   entering view in a burst don't starve a high-priority one.

See [METHODOLOGY.md](./METHODOLOGY.md) for how to verify this with real
measurements rather than taking the above on faith.
