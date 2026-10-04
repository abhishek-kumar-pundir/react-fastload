import type {
  RegisterResourceInput,
  ResourceRecord,
  ResourceState,
} from "./types";

type Listener = (resources: ResourceRecord[]) => void;

/**
 * ResourceRegistry is the single source of truth for every resource
 * ReactFastLoad knows about. It does not make loading decisions itself —
 * that's the PriorityEngine and Scheduler's job — it only stores state
 * and notifies subscribers when that state changes.
 */
export class ResourceRegistry {
  private resources = new Map<string, ResourceRecord>();
  private listeners = new Set<Listener>();

  register(input: RegisterResourceInput): ResourceRecord {
    const existing = this.resources.get(input.id);
    if (existing) {
      return existing;
    }

    const record: ResourceRecord = {
      id: input.id,
      type: input.type,
      priority: input.priority,
      strategy: input.strategy,
      state: "idle",
      estimatedSize: input.estimatedSize,
      meta: input.meta,
      deferred: false,
      prefetched: false,
      abortController: typeof AbortController !== "undefined" ? new AbortController() : undefined,
      timestamps: {
        registeredAt: now(),
      },
    };

    this.resources.set(input.id, record);
    this.emit();
    return record;
  }

  unregister(id: string): void {
    if (this.resources.delete(id)) {
      this.emit();
    }
  }

  get(id: string): ResourceRecord | undefined {
    return this.resources.get(id);
  }

  has(id: string): boolean {
    return this.resources.has(id);
  }

  all(): ResourceRecord[] {
    return Array.from(this.resources.values());
  }

  byState(state: ResourceState): ResourceRecord[] {
    return this.all().filter((r) => r.state === state);
  }

  update(id: string, patch: Partial<ResourceRecord>): ResourceRecord | undefined {
    const record = this.resources.get(id);
    if (!record) return undefined;

    const updated: ResourceRecord = {
      ...record,
      ...patch,
      timestamps: { ...record.timestamps, ...patch.timestamps },
    };
    this.resources.set(id, updated);
    this.emit();
    return updated;
  }

  /**
   * Returns the CURRENT record after the transition — not the stale
   * pre-call reference. This matters: a caller that does
   * `const r = registry.setState(id, "eligible")` must see `r.state ===
   * "eligible"`, not whatever `r` looked like before this call, since
   * `update()` replaces the Map entry with a new object rather than
   * mutating the old one in place. (This exact mismatch was a real bug
   * in LoadManager.register(), caught by a clean-install runtime smoke
   * test — see CHANGELOG.) Returns `undefined` only if `id` isn't
   * registered at all.
   */
  setState(id: string, state: ResourceState): ResourceRecord | undefined {
    const record = this.resources.get(id);
    if (!record) return undefined;
    if (record.state === state) return record;

    const timestamps = { ...record.timestamps };
    const t = now();
    if (state === "eligible" && !timestamps.eligibleAt) timestamps.eligibleAt = t;
    if (state === "loading" && !timestamps.loadStartedAt) timestamps.loadStartedAt = t;
    if ((state === "loaded" || state === "error") && !timestamps.loadEndedAt) {
      timestamps.loadEndedAt = t;
    }

    return this.update(id, { state, timestamps });
  }

  setViewportDistance(id: string, distance: number): void {
    this.update(id, { viewportDistance: distance });
  }

  markDeferred(id: string): void {
    this.update(id, { deferred: true });
  }

  markPrefetched(id: string): void {
    this.update(id, { prefetched: true });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void {
    this.resources.clear();
    this.emit();
  }

  /** Aggregate counters used by the metrics layer. Pure derived data, no side effects. */
  summary() {
    const all = this.all();
    let deferredRequests = 0;
    let bytesDeferred = 0;
    let imagesDeferred = 0;
    let videosDeferred = 0;
    let audiosDeferred = 0;
    let componentsDeferred = 0;

    for (const r of all) {
      if (r.deferred) {
        deferredRequests += 1;
        bytesDeferred += r.estimatedSize ?? 0;
        if (r.type === "image") imagesDeferred += 1;
        if (r.type === "video") videosDeferred += 1;
        if (r.type === "audio") audiosDeferred += 1;
        if (r.type === "component") componentsDeferred += 1;
      }
    }

    return {
      totalRequests: all.length,
      initialRequests: all.filter((r) => !r.deferred).length,
      deferredRequests,
      deferredResources: deferredRequests,
      bytesDeferred,
      imagesDeferred,
      videosDeferred,
      audiosDeferred,
      componentsDeferred,
    };
  }

  private emit(): void {
    const snapshot = this.all();
    for (const listener of this.listeners) listener(snapshot);
  }
}

function now(): number {
  return typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}
