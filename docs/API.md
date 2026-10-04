# API Reference

## `<FastLoadProvider>`

```tsx
<FastLoadProvider strategy="adaptive" preloadDistance={1000} concurrency={4} debug={false}>
  <App />
</FastLoadProvider>
```

| Prop | Type | Default | Description |
|---|---|---|---|
| `strategy` | `"adaptive" \| "eager" \| "conservative"` | `"adaptive"` | Sets a default concurrency (`4` / `8` / `2`) unless `concurrency` is explicitly given. |
| `preloadDistance` | `number` | `1000` | Pixels before the viewport at which a resource becomes eligible to load. |
| `concurrency` | `number` | derived from `strategy` | Max resources actively loading at once, across all types. |
| `debug` | `boolean` | `false` | Renders a floating debug panel (dev builds only) showing registered resources, their state, and recent scheduler decisions. |

Exactly one `LoadManager` (registry + scheduler + metrics) is created per
provider instance. Nested providers create independent scheduling domains.

## `<SmartImage>`

```tsx
<SmartImage
  src="/photo.webp"
  alt="…"
  priority="auto"        // "auto" | "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "IDLE"
  strategy="auto"         // "auto" | "eager" | "lazy"
  placeholder="/ph.webp"
  estimatedSize={45000}   // bytes; only affects the bytesDeferred metric
  resourceId="hero-photo" // optional; defaults to `image:${src}` — see note below
/>
```

**Default id and request deduplication:** `resourceId` defaults to
`image:${src}` (same for `SmartVideo`/`SmartAudio`, with `video:`/
`audio:`), not a per-instance random id. This means two mounted
components with the same `src` automatically share one load instead of
each firing its own — true request deduplication, not just visual
reuse. Pass an explicit `resourceId` only when two elements with the same
`src` genuinely need independent scheduling (e.g. deliberately rendering
the same demo image twice with different priorities).

All other standard `<img>` attributes (`className`, `style`, `width`,
`height`, `onLoad`, `onError`, etc.) pass through. Before the resource
becomes eligible, `SmartImage` renders a `<div role="img">` (optionally
showing `placeholder` as a background image) instead of a real `<img>` —
this is what actually prevents the browser from requesting the image early,
which native `loading="lazy"` cannot do below a shared, cross-resource
preload distance.

## `<SmartVideo>`

```tsx
<SmartVideo
  src="/clip.mp4"
  poster="/poster.webp"
  priority="auto"
  autoplay={false}
  controls
  aspectRatio="16/9"
/>
```

Below the preload zone, renders only the poster with a click/keyboard-
activatable overlay (`role="button"`) — no video bytes are requested.
Once eligible, mounts a real `<video>` with `preload="auto"` for
`CRITICAL`/`HIGH` priority or `preload="metadata"` otherwise.
`autoplay` is only honored once the video is actually eligible, and
implies `muted` (required by browsers for autoplay to work at all).
`aspectRatio` (CSS `aspect-ratio` syntax, e.g. `"16/9"`) is applied to
both the placeholder and the real element — without it, the two can
render at different heights and cause a layout shift (CLS) when one
replaces the other; pass it (or reserve space yourself via a wrapping
container) for any video whose aspect ratio you know ahead of time.

## `<SmartAudio>`

```tsx
<SmartAudio
  src="/track.mp3"
  label="Episode 12"
  priority="auto"
  autoplay={false}
  controls
  estimatedSize={4_200_000}
/>
```

The audio equivalent of `<SmartVideo>` — for songs, podcasts, sound
effects. Below the preload zone, renders a small click/keyboard-
activatable placeholder (`role="button"`, labeled from `label` if given)
instead of a real `<audio>` element. Once eligible, mounts a real
`<audio>` with `preload="auto"` for `CRITICAL`/`HIGH` priority or
`preload="metadata"` otherwise — the browser's own streaming/range-request
behavior handles the actual byte transfer once mounted; this library never
fetches audio data itself. `autoplay` follows the same semantics as
`SmartVideo`: only honored once eligible, and implies `muted`.

## `lazyComponent(importFn, options)`

```tsx
const Analytics = lazyComponent(() => import("./Analytics"), {
  priority: "LOW",
  fallback: <Spinner />,
});

<Analytics {...props} />
```

Wraps `React.lazy` + `Suspense` so the dynamic `import()` itself doesn't
fire until the component is eligible (in the preload zone, or
`eager`/`CRITICAL`) — plain `React.lazy` fetches as soon as it's first
rendered, with no "not yet" concept. Options:

| Option | Type | Default |
|---|---|---|
| `priority` | `Priority` | `"NORMAL"` |
| `strategy` | `LoadingStrategy` | `"eager"` if `priority === "CRITICAL"`, else `"lazy"` |
| `placeholder` | `ReactNode` | `null` |
| `fallback` | `ReactNode` | `placeholder` |
| `resourceId` | `string` | generated |

## Hooks

### `useLazyLoad(options)`

The lower-level hook `SmartImage`/`SmartVideo`/`lazyComponent` are all built
on. Use it directly to build a custom resource wrapper against the same
scheduler.

```ts
const { ref, state, record } = useLazyLoad({
  id, type, priority, strategy, loader, estimatedSize, meta,
});
```

`ref` is a callback ref to attach to the DOM node whose viewport position
should be tracked. `state` is one of `"idle" | "eligible" | "loading" |
"loaded" | "error"`.

### `usePriority(resourceId, priority)`

Updates an already-registered resource's priority — e.g. bump an image from
`LOW` to `HIGH` on hover, or when a carousel slide becomes active.

### `useFastLoadMetrics()`

Returns a live-updating `FastLoadMetrics` snapshot (see
[METHODOLOGY.md](./METHODOLOGY.md) for what each field means and where it
comes from):

```ts
interface FastLoadMetrics {
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  ttfb: number | null;
  totalResourcesObserved: number;
  totalTransferBytesObserved: number;
  initialRequests: number;
  deferredRequests: number;
  deferredResources: number;
  bytesDeferred: number;
  imagesDeferred: number;
  videosDeferred: number;
  audiosDeferred: number;
  componentsDeferred: number;
}
```

## Advanced / debug exports

`LoadManager`, `ResourceRegistry`, `PriorityEngine`, and `Scheduler` are
exported directly for building custom resource wrappers or inspecting
scheduler behavior in tests. These are lower-level than the component/hook
API and may change more freely between minor versions — prefer the
components/hooks above for application code.
