import type { ScenarioName } from "./data";

export interface RunRecord {
  scenario: ScenarioName;
  mode: "baseline" | "fastload";
  run: number;

  // Initial-window vitals & counts (see metrics.ts for the window definition).
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  ttfb: number | null;
  initialRequests: number;
  initialTransferredBytes: number;

  // Scheduler's own bookkeeping (ReactFastLoad only; null on Baseline).
  deferredRequests: number | null;
  estimatedDeferredBytes: number | null;
  /** Real (not estimated) bytes for deferred resources that had actually finished loading by the eventual snapshot. Null if none had. */
  actuallyDeferredBytes: number | null;
  actuallyDeferredMatchedCount: number | null;

  // Eventual snapshot (network-idle heuristic or hard cap — see metrics.ts).
  eventualRequests: number;
  eventualTransferredBytes: number;
  cacheHits: number;
  cacheMisses: number;
}

const STORAGE_KEY = "react-fastload-benchmark-runs-v2";

function readAll(): RunRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RunRecord[]) : [];
  } catch {
    return [];
  }
}

function writeAll(records: RunRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    /* storage unavailable/full — the run just won't be persisted */
  }
}

export function clearRuns(scenario?: ScenarioName): void {
  if (!scenario) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  writeAll(readAll().filter((r) => r.scenario !== scenario));
}

export function recordRun(record: RunRecord): void {
  const all = readAll();
  all.push(record);
  writeAll(all);
}

export function getRuns(scenario: ScenarioName): RunRecord[] {
  return readAll().filter((r) => r.scenario === scenario);
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)]!;
}

export interface Stat {
  median: number | null;
  p75: number | null;
  p95: number | null;
  n: number;
}

export function summarize(values: Array<number | null>): Stat {
  const clean = values.filter((v): v is number => v !== null).slice().sort((a, b) => a - b);
  return {
    median: percentile(clean, 50),
    p75: percentile(clean, 75),
    p95: percentile(clean, 95),
    n: clean.length,
  };
}
