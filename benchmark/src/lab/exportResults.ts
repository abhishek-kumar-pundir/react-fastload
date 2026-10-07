import type { TimelineRow } from "./synthetic";
import type { SchedulerDecision } from "react-fastload";

export interface LabExport {
  exportedAt: string;
  scenario: string;
  schedulerEnabled: boolean;
  configuration: Record<string, unknown>;
  environment: {
    userAgent: string;
    viewport: { width: number; height: number };
  };
  timeline: TimelineRow[];
  schedulerDecisions: SchedulerDecision[];
  warnings: string[];
}

export function buildLabExport(params: {
  scenario: string;
  schedulerEnabled: boolean;
  configuration: Record<string, unknown>;
  timeline: TimelineRow[];
  schedulerDecisions: SchedulerDecision[];
}): LabExport {
  return {
    exportedAt: new Date().toISOString(),
    scenario: params.scenario,
    schedulerEnabled: params.schedulerEnabled,
    configuration: params.configuration,
    environment: {
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      viewport: {
        width: typeof window !== "undefined" ? window.innerWidth : 0,
        height: typeof window !== "undefined" ? window.innerHeight : 0,
      },
    },
    timeline: params.timeline,
    schedulerDecisions: params.schedulerDecisions,
    warnings: [
      "Timings come from an artificial per-resource delay (synthetic loader), not real network requests — this isolates scheduler behavior from network/CPU variance. It does not measure real page load performance.",
      "Single-run result. Re-run multiple times and compare before drawing conclusions — see the repeated-run harness on the Light/Heavy/Extreme pages for a statistically aggregated (median/p75/p95) comparison using real resources instead.",
    ],
  };
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
