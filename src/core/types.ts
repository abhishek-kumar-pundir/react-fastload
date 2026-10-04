/**
 * Shared type definitions for the ReactFastLoad scheduling engine.
 *
 * These types are the contract between the registry, priority engine,
 * observers, and scheduler. Keep this file dependency-free so it can be
 * imported from anywhere without pulling in React or DOM-heavy code.
 */

export type Priority = "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "IDLE";

export type ResourceType = "image" | "video" | "audio" | "component" | "other";

export type ResourceState =
  | "idle" // registered, not yet eligible
  | "eligible" // conditions met, waiting for a scheduler slot
  | "loading" // actively loading
  | "loaded" // finished successfully
  | "error"; // failed to load

export type LoadingStrategy = "eager" | "lazy" | "auto";

export interface ResourceTimestamps {
  /** When the resource was registered with the registry. */
  registeredAt: number;
  /** When the resource became eligible to load (left "idle"). */
  eligibleAt?: number;
  /** When the scheduler handed the resource to its loader. */
  loadStartedAt?: number;
  /** When loading finished (success or error). */
  loadEndedAt?: number;
}

export interface ResourceRecord {
  id: string;
  type: ResourceType;
  priority: Priority;
  state: ResourceState;
  /** Estimated byte size, if known (e.g. from a srcset hint, or measured via Resource Timing after load). */
  estimatedSize?: number;
  /** Distance from the viewport in pixels at last measurement. <= 0 means intersecting. */
  viewportDistance?: number;
  strategy: LoadingStrategy;
  timestamps: ResourceTimestamps;
  /** True if the scheduler intentionally delayed this resource past its natural request time. */
  deferred: boolean;
  /** True if this resource was proactively prefetched ahead of viewport entry. */
  prefetched: boolean;
  /** Arbitrary metadata a resource loader may attach (e.g. natural width/height, video duration). */
  meta?: Record<string, unknown>;
  /**
   * Created once per registry entry (not per mounted component — see
   * LoadManager's reference counting). A loader may read
   * `resource.abortController?.signal` to cancel in-flight work; the
   * registry calls `.abort()` when the LAST consumer of this id
   * unmounts. `undefined` in environments without AbortController.
   */
  abortController?: AbortController;
}

export type RegisterResourceInput = Pick<
  ResourceRecord,
  "id" | "type" | "priority" | "strategy"
> &
  Partial<Pick<ResourceRecord, "estimatedSize" | "meta">>;

export interface SchedulerDecision {
  resourceId: string;
  action: "load" | "defer" | "prefetch";
  reason: string;
  timestamp: number;
}

export interface ConnectionInfo {
  /** Effective connection type, e.g. "4g", "3g", "2g", "slow-2g". Null if unsupported. */
  effectiveType: string | null;
  /** Estimated downlink in Mbps. Null if unsupported. */
  downlink: number | null;
  /** Estimated round-trip time in ms. Null if unsupported. */
  rtt: number | null;
  /** User has requested reduced data usage. */
  saveData: boolean;
  /** Whether the Network Information API is supported in this environment. */
  supported: boolean;
}

export interface SchedulerOptions {
  /** Maximum number of resources the scheduler will actively load at once. Default 4. */
  concurrency?: number;
  /** Called whenever the scheduler makes a decision about a resource. Used by debug mode. */
  onDecision?: (decision: SchedulerDecision) => void;
}

export interface FastLoadDebugSnapshot {
  resources: ResourceRecord[];
  decisions: SchedulerDecision[];
  connection: ConnectionInfo;
}
