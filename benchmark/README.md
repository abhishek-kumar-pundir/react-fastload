# ReactFastLoad benchmark

A runnable comparison app covering three content weights, a repeated-run
harness with median/p75/p95, and a three-part **Initial / Scheduler /
Eventual** dashboard — replacing an earlier single "Transferred" number
that conflated "what's been sent so far" with "everything this page will
ever request," which read as a much bigger win than it was.

## Self-hosted assets — no redirects

Gallery, hero, and video-poster images are generated locally (see
`scripts/generate-assets.py`) and served from Vite's `public/` folder with
plain `200` responses. An earlier version used a third-party image host
whose URLs 302-redirected to a CDN before the actual JPEG, adding noise to
the network waterfall. `src/asset-sizes.json` records each generated
file's *exact* byte size, so the "estimated deferred bytes" metric for
images is a real number, not a formula guess — video files remain small
external CC0 clips from MDN, since generating real video isn't practical
here, and their sizes stay labeled as estimates for that reason.

## Scenarios

| Scenario | Content | Hypothesis |
|---|---|---|
| **Light** | 5 images, 1 component, 0 video | Baseline ≈ ReactFastLoad. |
| **Heavy** | 30 images, 3 videos, 10 components | Baseline should measurably lag — not guaranteed, measure it. |
| **Extreme** | 50 images, 5 videos, 20 components | Stress test. |

Switch scenarios with the nav links, or the `?scenario=` URL param.

## The dashboard

Both pages show three boxes, live-updating:

- **INITIAL LOAD** — FCP/LCP/TTFB/CLS, and requests/bytes transferred
  *up to the browser's `load` event* specifically (not an arbitrary
  timeout — see docs/METHODOLOGY.md for why that boundary was chosen).
- **SCHEDULER** (ReactFastLoad page only) — the scheduler's own
  bookkeeping: deferred requests, estimated deferred bytes (from
  `estimatedSize` props), and **actually deferred bytes** — real,
  measured bytes for deferred resources that have *actually finished
  loading* so far, matched against real Resource Timing entries. This is
  never presented as "bytes saved" — a resource that hasn't loaded yet
  isn't avoided, just not loaded yet.
- **EVENTUAL (so far)** — total requests/bytes/cache hits observed as of
  right now. Deliberately labeled "so far," not "total," because it keeps
  growing as long as the tab stays open and more resources load.

A per-resource inventory table (id/size/state/cache status) sits below
each page's content — read from the scheduler's own registry on the
ReactFastLoad page, reconstructed from real Resource Timing entries on
Baseline.

## Manual comparison

1. Load `?mode=baseline&scenario=heavy`, let it settle, note the
   dashboard and resource inventory.
2. **Hard-reload** into `?mode=fastload&scenario=heavy`.
3. Compare Initial vs. Initial, Eventual vs. Eventual — never Initial on
   one side against Eventual on the other. Open DevTools Network for the
   real source of truth.

## Repeated-run comparison (median / p75 / p95)

Click **"Start N-run comparison."** This clears previous runs for the
scenario, then alternates Baseline → ReactFastLoad → Baseline → … N
times. On each page load it captures:

1. An **Initial** snapshot right at the `load` event.
2. An **Eventual** snapshot after a network-idle heuristic (resource
   count unchanged for ~1.2s) or a 12-second hard cap, whichever comes
   first.

...then navigates to the next step. The final **Results** page
(`?mode=results`) shows median/p75/p95 for every Initial/Scheduler/
Eventual field, Baseline vs. ReactFastLoad, plus the raw per-run data.

### What this does and doesn't control for

This is a **client-only approximation**, not a controlled lab
measurement:

- It does **not** clear the HTTP cache, DNS cache, or warmed connections
  between runs.
- It does **not** control or randomize network throttling — set
  DevTools' throttle manually before starting a run, and keep it
  consistent across the whole sequence.
- The network-idle heuristic and 12s cap are pragmatic, not a guarantee
  of the page's full resource lifetime — a resource that only loads on a
  scroll/interaction that never happens during an automated run won't
  appear in either window.
- It runs in one real browser tab, not multiple isolated processes.

For a fully controlled comparison, use a fresh private/incognito window
per run, or an external tool like Lighthouse CI or Playwright with
explicit cache/network control.

## Running it

```bash
cd benchmark
npm install
npm run dev
```

If you change image counts/dimensions in `src/data.ts`, regenerate the
assets: see `scripts/README.md`.
