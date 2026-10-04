import { PriorityEngine } from "./PriorityEngine";
import { ResourceRegistry } from "./ResourceRegistry";
import { Scheduler, type LoaderFn } from "./Scheduler";
import { ViewportObserver, type ViewportCallback } from "../observers/ViewportObserver";
import { getConnectionInfo, subscribeToConnectionChange } from "../utils/connection";
import type {
  ConnectionInfo,
  FastLoadDebugSnapshot,
  Priority,
  RegisterResourceInput,
  SchedulerDecision,
} from "./types";

export interface LoadManagerOptions {
  preloadDistance?: number;
  concurrency?: number;
  debug?: boolean;
}

/**
 * LoadManager wires together the registry, priority engine, and scheduler
 * into the single object that FastLoadProvider creates and shares via
 * context. This is the "central intellectual component" the architecture
 * calls for — resource wrappers (SmartImage, SmartVideo, LazyComponent)
 * only ever talk to a LoadManager instance, never to the DOM-observation
 * or scheduling internals directly.
 *
 * Two behaviors worth calling out because they're easy to get wrong:
 *
 * 1. Request deduplication: `register()` is reference-counted. Two
 *    mounted components that resolve to the SAME resource id (by default,
 *    `${type}:${src}` — see SmartImage/SmartVideo/SmartAudio) share ONE
 *    registry entry, one loader call, and one AbortController. The entry
 *    is only actually removed — and its AbortController only actually
 *    aborted — once every consumer has unregistered. Without this, an
 *    id reused by two instances would let the first unmount delete a
 *    resource the second instance still depends on.
 * 2. Viewport observation is centralized here as ONE shared
 *    IntersectionObserver for the whole provider, not one per resource.
 *    An earlier version had each `useLazyLoad` call create its own
 *    ViewportObserver — harmless correctness-wise, but wasteful: a page
 *    with 50 resources was creating 50 separate native
 *    IntersectionObserver instances all doing the same kind of work.
 */
export class LoadManager {
  readonly registry: ResourceRegistry;
  readonly priorityEngine: PriorityEngine;
  readonly scheduler: Scheduler;
  readonly viewportObserver: ViewportObserver;
  readonly preloadDistance: number;
  readonly debug: boolean;

  private connection: ConnectionInfo;
  private unsubscribeConnection?: () => void;
  private refCounts = new Map<string, number>();

  constructor(options: LoadManagerOptions = {}) {
    this.preloadDistance = options.preloadDistance ?? 1000;
    this.debug = options.debug ?? false;
    this.registry = new ResourceRegistry();
    this.priorityEngine = new PriorityEngine();
    this.viewportObserver = new ViewportObserver(this.preloadDistance);
    this.connection = getConnectionInfo();

    this.scheduler = new Scheduler(this.registry, this.priorityEngine, {
      concurrency: options.concurrency ?? 4,
      onDecision: this.debug ? (d) => this.logDecision(d) : undefined,
    });

    this.unsubscribeConnection = subscribeToConnectionChange((info) => {
      this.connection = info;
      this.requestPass();
    });
  }

  register(input: RegisterResourceInput) {
    const refCount = (this.refCounts.get(input.id) ?? 0) + 1;
    this.refCounts.set(input.id, refCount);

    let record = this.registry.register(input);
    if (input.strategy === "eager" || input.priority === "CRITICAL") {
      // Eager/critical resources skip viewport gating entirely. Idempotent —
      // safe to call again for a resource a second consumer just joined.
      // Use setState's return value, not the pre-call `record` above —
      // registry updates replace the stored object rather than mutating
      // it in place, so `record` itself would otherwise still read
      // "idle" even though the registry's own state is now "eligible".
      record = this.registry.setState(record.id, "eligible") ?? record;
      this.requestPass();
    }
    return record;
  }

  /**
   * Decrements the id's reference count. Only when it reaches zero — i.e.
   * the last mounted consumer of this resource has unmounted — does this
   * actually abort any in-flight load, remove the scheduler's loader, and
   * delete the registry entry. See the class doc for why.
   */
  unregister(id: string): void {
    const remaining = (this.refCounts.get(id) ?? 1) - 1;
    if (remaining > 0) {
      this.refCounts.set(id, remaining);
      return;
    }
    this.refCounts.delete(id);

    const record = this.registry.get(id);
    // Abort only if nothing else is using it (refCount just hit zero) and
    // it never finished — aborting a resource other consumers still want,
    // or one that already loaded successfully, would be a real bug (the
    // "don't abort resources shared by other consumers" requirement).
    if (record && record.state !== "loaded" && record.state !== "error") {
      record.abortController?.abort();
    }

    this.scheduler.unregisterLoader(id);
    this.registry.unregister(id);
  }

  setLoader(id: string, loader: LoaderFn): void {
    this.scheduler.registerLoader(id, loader);
    this.requestPass();
  }

  /**
   * Attaches the shared ViewportObserver to an element for a given
   * resource id. Returns an unobserve function. A no-op (returning a
   * no-op cleanup) for resources that skip viewport gating — callers
   * don't need to branch on that themselves.
   */
  observeViewport(id: string, element: Element): () => void {
    const callback: ViewportCallback = (distance) => this.reportViewportDistance(id, distance);
    this.viewportObserver.observe(element, callback);
    return () => this.viewportObserver.unobserve(element);
  }

  /** Called whenever a resource's distance-from-viewport changes. */
  reportViewportDistance(id: string, distance: number): void {
    const record = this.registry.get(id);
    if (!record) return;

    this.registry.setViewportDistance(id, distance);

    if (record.state === "idle") {
      const withinZone = this.priorityEngine.isWithinPreloadZone(distance, this.preloadDistance);
      if (withinZone) {
        this.registry.setState(id, "eligible");
        if (distance > 0) {
          this.scheduler.prefetch(id, `entered preload zone at ${Math.round(distance)}px`);
        }
      } else {
        this.scheduler.defer(id, `outside preload zone (${Math.round(distance)}px > ${this.preloadDistance}px)`);
      }
    }

    this.requestPass();
  }

  requestPass(): void {
    this.scheduler.requestPass({
      connection: this.connection,
      preloadDistance: this.preloadDistance,
    });
  }

  getConnection(): ConnectionInfo {
    return this.connection;
  }

  getDebugSnapshot(): FastLoadDebugSnapshot {
    return {
      resources: this.registry.all(),
      decisions: this.scheduler.getDecisionLog(),
      connection: this.connection,
    };
  }

  setPriority(id: string, priority: Priority): void {
    this.registry.update(id, { priority });
    this.requestPass();
  }

  destroy(): void {
    this.unsubscribeConnection?.();
    this.viewportObserver.disconnect();
    this.refCounts.clear();
    this.registry.clear();
  }

  private logDecision(decision: SchedulerDecision): void {
    if (typeof console === "undefined") return;
    // eslint-disable-next-line no-console
    console.debug(
      `[react-fastload] ${decision.action} "${decision.resourceId}" — ${decision.reason}`
    );
  }
}
