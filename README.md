# react-fastload

**An adaptive resource-loading scheduler for React — with real,
browser-measured performance metrics instead of marketing claims.**

<p>
  <img alt="npm version" src="https://img.shields.io/npm/v/react-fastload?color=cb3837&label=npm" />
  <img alt="license" src="https://img.shields.io/badge/license-MIT-lightgrey" />
  <img alt="types" src="https://img.shields.io/badge/types-TypeScript-3178c6" />
  <img alt="bundle" src="https://img.shields.io/badge/tree--shakeable-yes-brightgreen" />
</p>

One shared scheduler coordinates *when* images, video, audio, and
dynamically imported components actually fetch — based on viewport
proximity, priority, network conditions, and a concurrency budget —
instead of each resource type solving "don't load this yet" independently
with no coordination between them.

```tsx
import { FastLoadProvider, SmartImage, SmartVideo, SmartAudio, lazyComponent } from "react-fastload";

const Analytics = lazyComponent(() => import("./Analytics"), { priority: "LOW" });

function App() {
  return (
    <FastLoadProvider strategy="adaptive" preloadDistance={1000}>
      <SmartImage src="/hero.webp" alt="Hero" priority="CRITICAL" />
      <SmartImage src="/card.webp" alt="Card" priority="auto" />
      <SmartVideo src="/demo.mp4" poster="/poster.webp" priority="LOW" />
      <SmartAudio src="/theme.mp3" label="Theme song" priority="IDLE" />
      <Analytics />
    </FastLoadProvider>
  );
}
```

## Table of contents

- [Installation](#installation)
- [Why this exists](#why-this-exists)
- [How it works](#how-it-works)
- [How it differs from native lazy loading / React.lazy / code splitting](#how-it-differs)
- [Quick start](#quick-start)
- [Reading live metrics](#reading-live-metrics)
- [Debug mode](#debug-mode)
- [API reference](#api-reference)
- [Browser compatibility](#browser-compatibility)
- [When to use it — and when not to](#when-to-use-it--and-when-not-to)
- [Benchmarks — and their current limitations](#benchmarks--and-their-current-limitations)
- [Limitations](#limitations)
- [Roadmap](#roadmap)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Installation

```bash
npm install react-fastload
# or
pnpm add react-fastload
# or
yarn add react-fastload
```

Peer dependencies: `react >= 17`, `react-dom >= 17`. Ships ESM + CommonJS
builds and full TypeScript declarations; React is not bundled.

## Why this exists

Native `loading="lazy"` and `React.lazy` each solve one narrow slice of
"don't fetch this yet," independently, with **no shared concept of
priority and no shared concurrency budget across resource types.** A page
with many below-the-fold images, a video, and a few lazy components can
still burst-request everything with no coordination — the network has no
way to know your `HIGH`-priority hero image matters more than a `LOW`-
priority footer icon that happened to scroll into view a moment earlier.

ReactFastLoad puts images, video, and components through **one registry
and one priority-aware scheduler**, so priority is meaningful across the
whole page, not just within one resource type.

## How it works

```
Resource → Registry → Priority Engine → Viewport/Network/User signals
  → Scheduler → Loading decision → Browser resource → Metrics
```

- **Registry** — bookkeeping for every resource ReactFastLoad knows about:
  id, type, priority, state, viewport distance, timestamps.
- **Priority Engine** — turns declared priority (`CRITICAL` → `IDLE`) plus
  live signals (viewport distance, connection quality) into an effective
  score. `CRITICAL` always loads first, unconditionally.
- **Scheduler** — dispatches eligible resources within a concurrency cap,
  in priority order, and logs every decision it makes.
- **Metrics** — real `PerformanceObserver` / Navigation / Resource Timing
  reads, kept strictly separate from ReactFastLoad's own internal
  bookkeeping (see [Benchmarks](#benchmarks--and-their-current-limitations)).

Two things that happen automatically, not as opt-in features: **request
deduplication** (two components rendering the same `src` share one load,
not two — see `LoadManager`'s reference counting in
[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)) and **abort-on-unmount**
(an in-flight, not-yet-loaded resource is cancelled via `AbortController`
once its last consumer unmounts, rather than finishing a fetch nobody
needs anymore).

Full detail in [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## How it differs

| | Native `loading="lazy"` | `React.lazy` | ReactFastLoad |
|---|---|---|---|
| Cross-resource priority | ❌ | ❌ | ✅ shared priority levels |
| Shared concurrency budget | ❌ (browser-managed, opaque) | ❌ | ✅ configurable |
| Works across images + video + audio + components | per-`<img>` only | components only | ✅ all four, one scheduler |
| Configurable preload distance | limited/inconsistent | n/a | ✅ `preloadDistance` |
| Debug visibility into *why* something loaded when | ❌ | ❌ | ✅ debug panel + decision log |

It doesn't replace these mechanisms — `SmartImage` still sets
`decoding="async"` and `fetchpriority`; `lazyComponent` still relies on
your bundler's code splitting. It adds a coordination layer on top.

## Quick start

```tsx
import { FastLoadProvider, SmartImage, SmartVideo, lazyComponent, useFastLoadMetrics } from "react-fastload";

const Analytics = lazyComponent(() => import("./Analytics"), { priority: "LOW" });

function Gallery({ items }: { items: { id: string; src: string; alt: string }[] }) {
  return (
    <FastLoadProvider strategy="adaptive" preloadDistance={1000}>
      <SmartImage src="/hero.webp" alt="Hero" priority="CRITICAL" />

      {items.map((item) => (
        <SmartImage key={item.id} src={item.src} alt={item.alt} priority="auto" />
      ))}

      <SmartVideo src="/demo.mp4" poster="/demo-poster.webp" priority="LOW" />
      <Analytics />
    </FastLoadProvider>
  );
}
```

## Reading live metrics

```tsx
function PerfBadge() {
  const { lcp, deferredRequests, bytesDeferred } = useFastLoadMetrics();
  return (
    <div>
      LCP: {lcp ? `${Math.round(lcp)}ms` : "measuring…"} · deferred: {deferredRequests} (
      {(bytesDeferred / 1024).toFixed(0)} KB est.)
    </div>
  );
}
```

Every field is documented in [docs/API.md](./docs/API.md) as one of three
kinds — **browser-observed** (from `PerformanceObserver`/Navigation/
Resource Timing), **internal** (ReactFastLoad's own bookkeeping), or
**estimated** (only as accurate as the `estimatedSize` you provide) — so
you always know what you're looking at.

## Debug mode

```tsx
<FastLoadProvider debug>
  <App />
</FastLoadProvider>
```

Renders a floating panel (dev builds only) listing every registered
resource, its state, and the scheduler's recent load/defer/prefetch
decisions with reasons — useful for verifying *why* something loaded when
it did, rather than guessing.

## API reference

See [docs/API.md](./docs/API.md) for the full `<FastLoadProvider>`,
`<SmartImage>`, `<SmartVideo>`, `<SmartAudio>`, `lazyComponent()`, hooks,
and type reference. `LoadManager`, `ResourceRegistry`, `PriorityEngine`, and
`Scheduler` are also exported directly for building custom resource
wrappers on the same scheduler.

## Browser compatibility

Every feature degrades gracefully instead of throwing:

| Feature | Fallback when unsupported |
|---|---|
| `IntersectionObserver` | Resource reports as immediately eligible |
| Network Information API | `ConnectionInfo` fields are `null`/`false`; no connection-based adjustment |
| `PerformanceObserver` (LCP/CLS/paint) | Corresponding metric fields stay `null`, never estimated |
| `fetchPriority` attribute | Omitted; `loading`/`decoding` still applied |
| `requestIdleCallback` | Falls back to a short `setTimeout` |

## When to use it — and when not to

**Use it when** your page has enough below-the-fold images/video/
components that load order and concurrency actually matter, and you want
one consistent priority model plus real metrics to verify the effect.

**Skip it when** your page only has a handful of resources (native
`loading="lazy"` is simpler and sufficient), or you need guaranteed load
order regardless of viewport (use `priority="CRITICAL"` + `strategy="eager"`
on those specific resources instead of reaching for a different tool).

## Benchmarks — and their current limitations

The `/benchmark` app compares a Baseline page (plain `<img>`/`<video>`/
`React.lazy`) against a ReactFastLoad page, reading real
`PerformanceObserver`/Navigation/Resource Timing values — nothing is
hardcoded. **That said, treat any single run's numbers as illustrative,
not conclusive**, until run under the protocol below. An early internal
run surfaced exactly the kind of confound this warning exists for: a TTFB
drop that a client-side scheduler cannot legitimately produce, which
almost always means the two pages weren't served under identical
navigation/cache/dev-server conditions. If you see something similar,
it's a benchmark-setup bug, not a real effect — see
[docs/METHODOLOGY.md](./docs/METHODOLOGY.md) for the full breakdown of
which metrics can and can't be affected by a client-side library, and for
known caveats (e.g. `transferSize` reporting `0` for opaque cross-origin
responses).

**For a defensible comparison:**
1. Serve both pages from a **production build**, not the dev server.
2. Alternate Baseline/ReactFastLoad runs in **fresh browser contexts**
   (no shared cache/service worker) rather than switching pages in the
   same tab.
3. Run each mode **multiple times** (e.g. 10 runs) and report median/p75,
   not a single sample.
4. Report **requests avoided** and **bytes transferred** as separate
   numbers — a library can cut transfer size substantially while barely
   changing request count, and conflating the two overstates what
   changed.
5. Only compare numbers gathered under identical connection/device
   conditions.

The benchmark app now supports exactly this: three content-weight
scenarios (Light/Heavy/Extreme) and a repeated-run harness that reports
median/p75/p95 rather than a single sample — see
[benchmark/README.md](./benchmark/README.md).

## Roadmap

Several larger ideas (request deduplication, a real dependency graph,
service-worker integration, predictive prefetch, chunked/range loading,
a multi-level cache) have been proposed for a future version. See
[docs/ROADMAP.md](./docs/ROADMAP.md) for an honest triage of which of
those are worth building next, which need more design first, and which
I'd push back on or scope down — rather than a promise to build all of
it.

## Limitations

- The scheduler only coordinates resources it's explicitly told about —
  it never intercepts `fetch`, monkey-patches globals, or touches
  third-party scripts.
- `CRITICAL`-priority resources are never delayed, by design — don't mark
  something `CRITICAL` unless it genuinely must load first regardless of
  network conditions.
- `bytesDeferred` is only as accurate as the `estimatedSize` you pass per
  resource — omit it and that resource contributes `0`, which can make
  the deferred-bytes total look artificially low even when real bytes
  were deferred. Pass `estimatedSize` on `SmartImage`/`SmartVideo`/
  `SmartAudio` for a meaningful number.
- LCP/CLS can still change after being read; see
  [docs/METHODOLOGY.md](./docs/METHODOLOGY.md).

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

```bash
cd benchmark
npm install
npm run dev
```

## Contributing

Issues and PRs welcome. Please include or update tests for any behavioral
change to `core/`, `observers/`, or `metrics/` — these are the modules the
rest of the library's correctness depends on.

## License

MIT — see [LICENSE](./LICENSE).
