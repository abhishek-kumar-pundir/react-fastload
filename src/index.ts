// Components
export { FastLoadProvider, useFastLoadContext } from "./components/FastLoadProvider";
export type { FastLoadProviderProps, FastLoadContextValue } from "./components/FastLoadProvider";

export { SmartImage } from "./components/SmartImage";
export type { SmartImageProps, PriorityProp } from "./components/SmartImage";

export { SmartVideo } from "./components/SmartVideo";
export type { SmartVideoProps } from "./components/SmartVideo";

export { SmartAudio } from "./components/SmartAudio";
export type { SmartAudioProps } from "./components/SmartAudio";

export { lazyComponent } from "./components/LazyComponent";
export type { LazyComponentOptions } from "./components/LazyComponent";

// Hooks
export { useLazyLoad } from "./hooks/useLazyLoad";
export type { UseLazyLoadOptions, UseLazyLoadResult } from "./hooks/useLazyLoad";

export { usePriority } from "./hooks/usePriority";

export { useFastLoadMetrics } from "./hooks/useFastLoadMetrics";

// Metrics types
export type { FastLoadMetrics } from "./metrics/MetricsCollector";
export type { WebVitalsSnapshot } from "./metrics/WebVitals";

// Core types (for advanced/debug use, and for developers building custom
// resource wrappers on top of the same scheduler).
export type {
  Priority,
  ResourceType,
  ResourceState,
  LoadingStrategy,
  ResourceRecord,
  ConnectionInfo,
  SchedulerDecision,
  FastLoadDebugSnapshot,
} from "./core/types";

export { LoadManager } from "./core/LoadManager";
export { ResourceRegistry } from "./core/ResourceRegistry";
export { PriorityEngine } from "./core/PriorityEngine";
export { Scheduler } from "./core/Scheduler";
