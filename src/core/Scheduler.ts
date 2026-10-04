import { PriorityEngine, type PriorityContext } from "./PriorityEngine";
import { ResourceRegistry } from "./ResourceRegistry";
import type { ResourceRecord, SchedulerDecision, SchedulerOptions } from "./types";

export type LoaderFn = (resource: ResourceRecord) => Promise<void>;

interface RunOptions {
  ctx: PriorityContext;
}

/**
 * Scheduler is the central coordinator described in the architecture:
 *
 *   Registry -> PriorityEngine -> signals -> Scheduler -> loading decision
 *
 * It owns no DOM logic and knows nothing about images/video/components —
 * it only decides, given the current registry state and priority scores,
 * which *eligible* resources get a loader slot right now, respecting a
 * concurrency cap so competing requests don't starve visible content.
 *
 * Loaders are registered per resource type by the resources/* modules and
 * invoked by the scheduler when it decides to load a resource.
 */
export class Scheduler {
  private concurrency: number;
  private onDecision?: (decision: SchedulerDecision) => void;
  private activeCount = 0;
  private loaders = new Map<string, LoaderFn>();
  private decisions: SchedulerDecision[] = [];
  private readonly maxDecisionLog = 200;
  private scheduled = false;

  constructor(
    private registry: ResourceRegistry,
    private priorityEngine: PriorityEngine,
    options: SchedulerOptions = {}
  ) {
    this.concurrency = options.concurrency ?? 4;
    this.onDecision = options.onDecision;
  }

  /** Register the function used to actually load a given resource id (called once per resource). */
  registerLoader(resourceId: string, loader: LoaderFn): void {
    this.loaders.set(resourceId, loader);
  }

  unregisterLoader(resourceId: string): void {
    this.loaders.delete(resourceId);
  }

  /**
   * Request a scheduling pass. Coalesced into a microtask so multiple
   * rapid registry updates (e.g. many IntersectionObserver callbacks in
   * one frame) only trigger a single pass.
   */
  requestPass(ctx: PriorityContext): void {
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      this.runPass({ ctx });
    });
  }

  /** Synchronous scheduling pass, exposed directly for tests and advanced use. */
  runPass({ ctx }: RunOptions): void {
    const eligible = this.registry
      .byState("eligible")
      .slice()
      .sort((a, b) => this.priorityEngine.compare(a, b, ctx));

    let freeSlots = this.concurrency - this.activeCount;
    if (freeSlots <= 0) return;

    for (const resource of eligible) {
      if (freeSlots <= 0) break;

      const loader = this.loaders.get(resource.id);
      if (!loader) continue; // no loader registered yet; skip until it is

      freeSlots -= 1;
      this.dispatch(resource, loader);
    }
  }

  private dispatch(resource: ResourceRecord, loader: LoaderFn): void {
    this.activeCount += 1;
    this.registry.setState(resource.id, "loading");
    this.record({
      resourceId: resource.id,
      action: "load",
      reason: `priority=${resource.priority} distance=${resource.viewportDistance ?? "unknown"}`,
      timestamp: nowMs(),
    });

    loader(resource)
      .then(() => {
        this.registry.setState(resource.id, "loaded");
      })
      .catch(() => {
        this.registry.setState(resource.id, "error");
      })
      .finally(() => {
        this.activeCount -= 1;
        this.unregisterLoader(resource.id);
      });
  }

  /** Explicitly defer a resource (used by observers when it leaves the preload zone again, or on slow connections). */
  defer(resourceId: string, reason: string): void {
    this.registry.markDeferred(resourceId);
    this.record({ resourceId, action: "defer", reason, timestamp: nowMs() });
  }

  prefetch(resourceId: string, reason: string): void {
    this.registry.markPrefetched(resourceId);
    this.record({ resourceId, action: "prefetch", reason, timestamp: nowMs() });
  }

  getDecisionLog(): SchedulerDecision[] {
    return this.decisions.slice();
  }

  private record(decision: SchedulerDecision): void {
    this.decisions.push(decision);
    if (this.decisions.length > this.maxDecisionLog) {
      this.decisions.shift();
    }
    this.onDecision?.(decision);
  }
}

function nowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
