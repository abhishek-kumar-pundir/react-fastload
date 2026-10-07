import { useEffect } from "react";
import type { SchedulerDecision } from "react-fastload";
import { useLabRun } from "../lab/useLabRun";
import type { SyntheticSpec, TimelineRow } from "../lab/synthetic";

export interface Session {
  rows: TimelineRow[];
  decisions: SchedulerDecision[];
  running: boolean;
  run: () => void;
  /** False until the Runner for the current configuration has mounted. */
  ready: boolean;
}

export const EMPTY_SESSION: Session = { rows: [], decisions: [], running: false, run: () => {}, ready: false };

/**
 * Hosts the Scenario Lab's own `useLabRun` hook (unchanged) and publishes
 * its state upward. The Workbench renders this with a `key` derived from the
 * configuration, so changing scenario / concurrency / scheduler toggle
 * mounts a FRESH hook instance: its LoadManager from the previous
 * configuration is destroyed on unmount and none of its rows, decisions or
 * timers can leak into the new configuration.
 */
export function Runner({
  specs,
  concurrency,
  enabled,
  onSession,
}: {
  specs: SyntheticSpec[];
  concurrency: number;
  enabled: boolean;
  onSession: (session: Session) => void;
}) {
  const { rows, decisions, running, run } = useLabRun(specs, concurrency, enabled);

  useEffect(() => {
    onSession({ rows, decisions, running, run, ready: true });
  }, [rows, decisions, running, run, onSession]);

  return null;
}
