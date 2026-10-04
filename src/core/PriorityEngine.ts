import type { ConnectionInfo, Priority, ResourceRecord } from "./types";

const PRIORITY_ORDER: Record<Priority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  IDLE: 4,
};

export interface PriorityContext {
  connection: ConnectionInfo;
  /** Preload distance in pixels, as configured on the provider. */
  preloadDistance: number;
}

/**
 * PriorityEngine turns a resource's declared priority plus live signals
 * (viewport distance, network conditions) into an *effective* priority
 * score used purely for ordering within the scheduler. It never mutates
 * the resource's declared priority — that stays whatever the developer set.
 */
export class PriorityEngine {
  /**
   * Lower score = loaded sooner. CRITICAL always sorts first regardless
   * of other signals, per the "never delay explicitly critical resources"
   * requirement.
   */
  score(resource: ResourceRecord, ctx: PriorityContext): number {
    if (resource.priority === "CRITICAL") return -Infinity;

    let score = PRIORITY_ORDER[resource.priority] * 1000;

    // Closer resources should load sooner within the same priority band.
    const distance = resource.viewportDistance;
    if (typeof distance === "number") {
      // Resources already in view (distance <= 0) get a strong boost.
      score += Math.max(distance, 0) / 10;
    } else {
      // Unknown viewport position (e.g. not yet observed): treat as far away,
      // but not so far it beats explicit LOW/IDLE ordering.
      score += 500;
    }

    // On slow/constrained connections, push LOW and IDLE priority further back
    // to avoid competing with visible content for limited bandwidth.
    if (this.isConstrainedConnection(ctx.connection)) {
      if (resource.priority === "LOW" || resource.priority === "IDLE") {
        score += 2000;
      }
    }

    return score;
  }

  compare(a: ResourceRecord, b: ResourceRecord, ctx: PriorityContext): number {
    return this.score(a, ctx) - this.score(b, ctx);
  }

  isConstrainedConnection(connection: ConnectionInfo): boolean {
    if (connection.saveData) return true;
    if (!connection.supported) return false;
    if (connection.effectiveType === "slow-2g" || connection.effectiveType === "2g") {
      return true;
    }
    if (typeof connection.downlink === "number" && connection.downlink > 0 && connection.downlink < 1.5) {
      return true;
    }
    return false;
  }

  /** Whether a resource sitting at `distance` px from the viewport should become eligible. */
  isWithinPreloadZone(distance: number | undefined, preloadDistance: number): boolean {
    if (typeof distance !== "number") return false;
    return distance <= preloadDistance;
  }
}
