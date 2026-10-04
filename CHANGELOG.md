# Changelog

All notable changes to ReactFastLoad are documented here.

## 0.1.0 — Initial public release

Pre-1.0 release. The public API is expected to be broadly stable but may
change based on real-world feedback.

### Added

- Adaptive resource scheduler with priority and concurrency control
- `FastLoadProvider`
- `SmartImage`, `SmartVideo`, and `SmartAudio`
- `lazyComponent()`
- `useLazyLoad`, `usePriority`, `useFastLoadMetrics`, and `useFastLoadContext`
- Viewport-aware preloading with a shared `IntersectionObserver`
- Resource deduplication and reference-counted cancellation
- Network-aware priority scheduling
- Debug panel and browser performance metrics
- TypeScript declarations
- ESM and CommonJS builds
- Benchmark application for testing scheduler behavior

### Fixed

- Guarded the debug panel's `process.env.NODE_ENV` access for browser environments
- Shared one `IntersectionObserver` across resources within a provider
- Fixed stale resource records returned during critical/eager registration
- Fixed `SmartImage` to use React's `fetchPriority` JSX property

### Known limitations

- Pre-1.0 API may change
- No built-in retry mechanism
- Browser network priority remains under browser control
- `lazyComponent()` requires React 18+
- Provider configuration is read on initial mount