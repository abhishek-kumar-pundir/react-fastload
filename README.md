# ReactFastLoad

[![npm version](https://img.shields.io/npm/v/react-fastload.svg)](https://www.npmjs.com/package/react-fastload)
[![license](https://img.shields.io/npm/l/react-fastload.svg)](https://github.com/abhishek-kumar-pundir/react-fastload/blob/main/LICENSE)
![types](https://img.shields.io/badge/types-TypeScript-3178c6)

An adaptive resource-loading scheduler for React. It prioritizes critical resources, defers non-critical ones, avoids duplicate work, and shows you why things loaded when they did.

ReactFastLoad coordinates the resources you register through its components and hooks (`SmartImage`, `SmartVideo`, `SmartAudio`, `lazyComponent`, `useLazyLoad`). It is **not** a `fetch`/XHR interceptor, a CDN, or a compression tool, and it does not make downloads faster by itself. It controls *when* managed resources are handed to the browser, and in *what order*.

> **Status:** `0.1.0` is the first public release. The API is small and tested but pre-1.0, so it may change. See [Limitations](#limitations).

## Features

- **Priority scheduling:** `CRITICAL`, `HIGH`, `NORMAL`, `LOW`, `IDLE`
- **Concurrency cap** on scheduler-dispatched loads (default `4`)
- **Viewport-aware preloading** via one shared `IntersectionObserver`
- **Deduplication:** components with the same resource id share one registry entry
- **Lazy media:** `SmartImage`, `SmartVideo`, `SmartAudio`
- **Scheduled component imports:** `lazyComponent()`
- **Connection awareness:** `LOW`/`IDLE` resources are pushed back on slow or data-saver connections
- **Cancellation** when the last consumer unmounts mid-load
- **Debug panel** and **metrics hook**
- TypeScript types, ESM and CommonJS builds

## Installation

```bash
npm install react-fastload
```

Peer dependencies: `react` and `react-dom` `>=17`. `lazyComponent` needs React 18+ (it uses `useId`).

## Quick start

```tsx
import { FastLoadProvider, SmartImage, SmartVideo } from "react-fastload";

export default function App() {
  return (
    <FastLoadProvider>
      {/* Above the fold: render immediately */}
      <SmartImage src="/hero.webp" alt="Hero" priority="CRITICAL" strategy="eager" width={1200} height={600} />

      {/* Below the fold: placeholder until it nears the viewport */}
      <SmartImage src="/gallery.webp" alt="Gallery" priority="LOW" style={{ width: 600, height: 400 }} />

      <SmartVideo src="/demo.mp4" poster="/poster.webp" priority="LOW" aspectRatio="16/9" />
    </FastLoadProvider>
  );
}
```

Every `Smart*` component, `lazyComponent` component and hook must render inside a `<FastLoadProvider>`, otherwise it throws.

## `FastLoadProvider`

Creates one scheduler and metrics collector for its subtree.

| Prop | Type | Default | Description |
|---|---|---|---|
| `strategy` | `"adaptive" \| "eager" \| "conservative"` | `"adaptive"` | Sets the default `concurrency` (`4` / `8` / `2`). Nothing else. |
| `concurrency` | `number` | `4` | Max scheduler-dispatched loads at once. Use a positive integer. |
| `preloadDistance` | `number` (px) | `1000` | How far outside the viewport a resource may be and still become eligible. |
| `debug` | `boolean` | `false` | Shows the [debug panel](#debug-mode) and logs decisions. |

Props are read once, on first render. To reconfigure, remount the provider (e.g. with a `key`). Nested providers are independent scheduling domains.

```tsx
<FastLoadProvider concurrency={2} preloadDistance={600} debug={process.env.NODE_ENV !== "production"}>
  <App />
</FastLoadProvider>
```

## Priority and strategy

**Priority** orders resources that are already eligible and competing for a slot:

| Value | Meaning |
|---|---|
| `CRITICAL` | Always first. Skips viewport gating, so it is eligible immediately. |
| `HIGH` | Ahead of `NORMAL`, `LOW`, `IDLE`. Still waits for the preload zone unless `eager`. |
| `NORMAL` | Default. `"auto"` on Smart components resolves to this. |
| `LOW` / `IDLE` | Ordered last. Pushed further back on constrained connections. |

Priority never makes a far-away resource eligible (except `CRITICAL`), and it is a hint to ReactFastLoad's own scheduling. The browser still decides actual network priority.

**Strategy** (per resource) controls when it becomes eligible:

| Value | Behavior |
|---|---|
| `"eager"` | Eligible immediately; the real element renders right away. Use for above-the-fold content. |
| `"lazy"` | Eligible when it enters the preload zone, then waits for a free slot. |
| `"auto"` | Default. `eager` if priority is `CRITICAL`, otherwise `lazy`. |

Don't confuse this with the provider's `strategy`, which only sets default concurrency. Marking many resources `eager` removes most of the benefit of scheduling.

## `SmartImage`

A drop-in `<img>` replacement.

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | required | Image URL. |
| `priority` | `Priority \| "auto"` | `"auto"` | See above. |
| `strategy` | `"eager" \| "lazy" \| "auto"` | `"auto"` | See above. |
| `placeholder` | `string` (URL) | none | Background shown on the placeholder `<div>` before the `<img>` mounts. |
| `resourceId` | `string` | `image:${src}` | Used for [deduplication](#deduplication) and `usePriority`. |
| `estimatedSize` | `number` (bytes) | none | Only feeds the `bytesDeferred` metric. |

All other `<img>` props (`alt`, `width`, `className`, `srcSet`, `onLoad`, `onError`, …) go to the real `<img>`. `decoding` defaults to `"async"`, and `fetchPriority` is derived from priority (see [note](#fetchpriority-note)).

**Layout:** before it loads, a lazy `SmartImage` renders a placeholder `<div>` that receives only `style`. It does not get `className`, `width` or `height`, so reserve space via `style` (e.g. `style={{ width: 320, height: 200 }}` or `aspectRatio`) to avoid layout shift.

## `SmartVideo`

Renders a poster-and-play placeholder until the video is eligible, so no video bytes are requested early. Clicking the placeholder (or pressing Enter/Space) mounts the real `<video>` immediately.

| Prop | Type | Default | Description |
|---|---|---|---|
| `src` | `string` | required | Video URL. |
| `poster` | `string` | none | Placeholder background and `<video>` poster. |
| `priority`, `strategy`, `resourceId`, `estimatedSize` | | | Same as `SmartImage` (`resourceId` defaults to `video:${src}`). |
| `aspectRatio` | `string` | none | e.g. `"16/9"`. Keeps the placeholder and video the same size. |
| `autoplay` | `boolean` | `false` | Honored once eligible; implies `muted`. Use this, not native `autoPlay`. |
| `controls` | `boolean` | **`true`** | Differs from native `<video>`. |

`preload` is managed for you (`auto` for `CRITICAL`/`HIGH`, otherwise `metadata`). The library never fetches video bytes itself.

```tsx
<SmartVideo src="/ambient.mp4" poster="/ambient.webp" autoplay loop playsInline controls={false} aspectRatio="21/9" />
```

## `SmartAudio`

The audio counterpart of `SmartVideo`: a click-to-load pill until eligible, then a real `<audio>`. It takes `src`, `priority`, `strategy`, `resourceId` (`audio:${src}`), `estimatedSize`, `autoplay`, `controls` (default `true`), `muted`, and a `label` for the placeholder text.

```tsx
<SmartAudio src="/episodes/12.mp3" label="Episode 12" priority="LOW" />
```

## `lazyComponent`

Like `React.lazy` + `Suspense`, but the `import()` doesn't start until the component's resource is eligible.

```tsx
import { lazyComponent } from "react-fastload";

const Chart = lazyComponent(() => import("./Chart"), {
  priority: "LOW",
  placeholder: <div style={{ height: 320 }} />,
  fallback: <p>Loading chart…</p>,
});
```

| Option | Default | Description |
|---|---|---|
| `priority` | `"NORMAL"` | Scheduling priority. |
| `strategy` | `eager` if `CRITICAL`, else `lazy` | When the import starts. |
| `placeholder` | `null` | Rendered until eligible. |
| `fallback` | `placeholder` | Suspense fallback while importing. |
| `resourceId` | unique per instance | Set it to share one registry entry. |

- Call it at module scope, not inside a component.
- The module needs a `default` export.
- Imports are not limited by `concurrency` and can't be cancelled.
- A failed import is cached and not retried; it surfaces to your nearest error boundary.

## Hooks

| Hook | Purpose |
|---|---|
| `useLazyLoad({ id, type, priority, strategy, loader })` | Low-level hook behind the Smart components. Returns `{ ref, state, record }`. Attach `ref` to the element to observe. |
| `usePriority(resourceId, priority)` | Changes the priority of a registered resource (e.g. on hover). Affects ordering only, not eligibility. |
| `useFastLoadMetrics()` | Live snapshot of FCP, LCP, CLS, TTFB, Resource Timing totals, and ReactFastLoad's own counters. |
| `useFastLoadContext()` | Provider internals (`loadManager`, `debug`) for inspection and integrations. |

`useLazyLoad` captures `priority`, `strategy` and `loader` at registration; the effect only re-runs when `id` changes. Its `loader` receives the resource record, so it can honor `resource.abortController?.signal`.

```tsx
function Card({ id, src }: { id: string; src: string }) {
  const [hovered, setHovered] = useState(false);
  usePriority(id, hovered ? "HIGH" : "LOW");
  return (
    <div onMouseEnter={() => setHovered(true)}>
      <SmartImage src={src} alt="" resourceId={id} priority="LOW" style={{ width: 320, height: 200 }} />
    </div>
  );
}
```

`useFastLoadMetrics` reports browser-measured values (`fcp`, `lcp`, `cls`, `ttfb`, resource totals) separately from ReactFastLoad's bookkeeping. The `deferredRequests` and `bytesDeferred` counters record scheduling *decisions*, not requests or bytes actually saved.

## Viewport preloading

Lazy resources become eligible before they're visible. `preloadDistance` (default `1000` px) is applied as the `rootMargin` of one shared `IntersectionObserver`, expanding the viewport on every side.

```tsx
<FastLoadProvider preloadDistance={1500}>
  <App />
</FastLoadProvider>
```

- Scrolling away does not cancel or revert anything.
- `CRITICAL` and `eager` resources aren't observed.
- Without `IntersectionObserver`, everything is eligible immediately.
- Resources inside nested scroll containers are also clipped by the container, so test carousels and scroll panes.

## Concurrency

`concurrency` limits how many scheduler-dispatched loads run at once. Extra eligible resources wait, ordered by priority and then distance.

```tsx
<FastLoadProvider concurrency={3}>
  <App />
</FastLoadProvider>
```

It does **not** limit browser connections, your own requests, `eager` elements, or `lazyComponent` imports. For non-critical video and audio the loader resolves immediately, so concurrency mostly decides *when their elements mount*.

## Deduplication

Components that resolve to the same resource id share one registry entry (one state, one loader, one `AbortController`). The default id is `${type}:${src}`.

```tsx
<SmartImage src="/logo.webp" alt="Logo" />
<SmartImage src="/logo.webp" alt="Logo" />   {/* same entry */}
```

This deduplicates ReactFastLoad's own scheduling. Each component still renders its own `<img>`, and the browser's cache decides the actual network requests. The first registrant's priority wins. Ids are plain strings (`"/a.webp"` ≠ `"./a.webp"`). To schedule the same `src` independently, pass distinct `resourceId`s.

The entry is aborted only when its last consumer unmounts before the load finishes.

## Debug mode

```tsx
<FastLoadProvider debug>
  <App />
</FastLoadProvider>
```

Shows a fixed bottom-right panel listing the connection, every registered resource (`[PRIORITY] id: state`), and recent scheduler decisions, and logs each decision with `console.debug` (enable "Verbose" in DevTools). The panel renders nothing when `NODE_ENV` is `production`.

## `fetchPriority` note

React's JSX property is `fetchPriority` (camelCase), not the HTML attribute `fetchpriority`. `SmartImage` sets it from the resolved priority when the browser supports it. React 19 accepts this; **React 18.x may log a dev-only "unrecognized prop" warning**, which is harmless. It's a hint, and the browser controls actual request priority.

## Complete example

```tsx
// App.tsx
import { FastLoadProvider, SmartAudio, SmartImage, SmartVideo, lazyComponent } from "react-fastload";

const Reviews = lazyComponent(() => import("./Reviews"), {
  priority: "LOW",
  placeholder: <div style={{ minHeight: 200 }} />,
  fallback: <p>Loading reviews…</p>,
});

const gallery = Array.from({ length: 24 }, (_, i) => `/gallery/${i + 1}.webp`);

export default function App() {
  return (
    <FastLoadProvider concurrency={3} preloadDistance={800} debug>
      <SmartImage src="/hero.webp" alt="Hero" priority="CRITICAL" strategy="eager" width={1280} height={640} />

      <SmartVideo src="/demo.mp4" poster="/demo-poster.webp" priority="HIGH" aspectRatio="16/9" />
      <SmartAudio src="/theme.mp3" label="Theme song" priority="IDLE" />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {gallery.map((src) => (
          <SmartImage key={src} src={src} alt="" style={{ width: "100%", aspectRatio: "4 / 3" }} />
        ))}
      </section>

      <Reviews />
    </FastLoadProvider>
  );
}
```

## When to use it

Worth considering for media-heavy pages with many below-the-fold resources, where you want explicit priority, shared concurrency limits, and visibility into loading decisions across images, media and code-split components.

For a small app with a few images, native `loading="lazy"` is likely enough. It won't help with server latency, unoptimized assets, third-party scripts, or `fetch` requests.

ReactFastLoad makes **no performance claims**. Results depend on your app, network and configuration, and misconfiguration can make things worse. Measure with Lighthouse, WebPageTest or real-user monitoring before and after.

## Limitations

- Only schedules resources registered through its components and hooks.
- The browser owns the network; priority and `fetchPriority` are hints.
- Concurrency covers scheduler-dispatched loads only.
- Needs `IntersectionObserver` for gating and `navigator.connection` for connection ordering; both degrade gracefully when missing.
- No retry and no built-in error fallback. A failed lazy `SmartImage` returns to its placeholder (`data-fastload-state="error"`), and `onError` isn't a reliable signal there.
- Provider props are not reactive after first render.
- `lazyComponent`'s `preloadDistance` option is accepted but currently ignored.
- `lazyComponent` requires React 18+ despite the `>=17` peer range.
- SSR: lazy media render placeholders on the server; use the components from Client Components where relevant. Hydration is untested.
- Tested in jsdom with a mocked `IntersectionObserver`; there are no real-browser tests yet.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

Requires Node.js `>=16`. A runnable benchmark app lives in `/benchmark` (not published to npm). Contributions are welcome: fork, add tests for behavior changes, run typecheck/test/build, and open a PR.

## Links

- [npm](https://www.npmjs.com/package/react-fastload) · [GitHub](https://github.com/abhishek-kumar-pundir/react-fastload) · [Issues](https://github.com/abhishek-kumar-pundir/react-fastload/issues) · [Changelog](./CHANGELOG.md)

## License

[MIT](./LICENSE)