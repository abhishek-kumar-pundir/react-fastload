import type { SyntheticSpec } from "../lab/synthetic";
import { PRIORITIES, DURATION_MS as PRIORITY_DURATION_MS, CONCURRENCY as PRIORITY_DEFAULT_CONCURRENCY } from "../lab/PriorityLab";
import { RESOURCE_COUNT, DURATION_MS as CONCURRENCY_DURATION_MS } from "../lab/ConcurrencyLab";

/**
 * The Overview drives the SAME two timeline workloads as the Scenario Lab
 * (same priorities, same resource counts, same artificial delays — the
 * constants are imported from the lab panels, not copied). Only the
 * id-building lines below mirror the lab's own one-line spec mapping.
 */
export type OverviewScenarioId = "priority" | "concurrency";

export interface OverviewScenario {
  id: OverviewScenarioId;
  label: string;
  summary: string;
  durationMs: number;
  defaultConcurrency: number;
  /** Matches the scenario names the Scenario Lab uses in its JSON export. */
  exportName: string;
  buildSpecs(): SyntheticSpec[];
  exportConfiguration(concurrency: number): Record<string, unknown>;
}

export const OVERVIEW_SCENARIOS: Record<OverviewScenarioId, OverviewScenario> = {
  priority: {
    id: "priority",
    label: "Priority ordering",
    summary: `${PRIORITIES.length} resources become eligible at the same instant; only the concurrency limit can load at once.`,
    durationMs: PRIORITY_DURATION_MS,
    defaultConcurrency: PRIORITY_DEFAULT_CONCURRENCY,
    exportName: "priority-ordering",
    buildSpecs: () =>
      PRIORITIES.map((priority, i) => ({ id: `${priority.toLowerCase()}-${i}`, priority, durationMs: PRIORITY_DURATION_MS })),
    exportConfiguration: (concurrency) => ({ concurrency, durationMs: PRIORITY_DURATION_MS, priorities: PRIORITIES }),
  },
  concurrency: {
    id: "concurrency",
    label: "Concurrency cap",
    summary: `${RESOURCE_COUNT} same-priority resources; the concurrency limit decides how many run at once.`,
    durationMs: CONCURRENCY_DURATION_MS,
    defaultConcurrency: 2,
    exportName: "concurrency-cap",
    buildSpecs: () =>
      Array.from({ length: RESOURCE_COUNT }, (_, i) => ({
        id: `res-${i}`,
        priority: "NORMAL" as const,
        durationMs: CONCURRENCY_DURATION_MS,
      })),
    exportConfiguration: (concurrency) => ({ concurrency, durationMs: CONCURRENCY_DURATION_MS, resourceCount: RESOURCE_COUNT }),
  },
};

export const SCENARIO_ORDER: OverviewScenarioId[] = ["priority", "concurrency"];

/** Planned axis length: how long the run is EXPECTED to take given the cap (used only to size the timeline axis). */
export function plannedSpanMs(resourceCount: number, durationMs: number, concurrency: number, schedulerEnabled: boolean): number {
  if (!schedulerEnabled) return durationMs;
  return Math.ceil(resourceCount / Math.max(1, concurrency)) * durationMs;
}
