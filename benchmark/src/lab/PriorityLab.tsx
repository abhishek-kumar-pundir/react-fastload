import React, { useMemo, useState } from "react";
import { useLabRun } from "./useLabRun";
import { Timeline } from "./Timeline";
import { SchedulerPanel } from "./SchedulerPanel";
import { Card, Button, Toggle } from "./ui";
import { buildLabExport, downloadJson } from "./exportResults";
import type { SyntheticSpec, TimelineRow } from "./synthetic";
import type { Priority, ResourceRecord } from "react-fastload";

export const PRIORITIES: Priority[] = ["CRITICAL", "HIGH", "NORMAL", "NORMAL", "LOW", "IDLE"];
export const DURATION_MS = 260;
export const CONCURRENCY = 2;

/**
 * Demonstrates: 6 resources become eligible at the SAME instant, but only
 * `concurrency` (2) can load at once. With the scheduler enabled, higher
 * priority consistently gets a slot first. With it disabled, all 6 fire
 * immediately — priority has no effect because nothing is coordinating
 * them.
 */
export function PriorityLab() {
  const [enabled, setEnabled] = useState(true);
  const specs: SyntheticSpec[] = useMemo(
    () => PRIORITIES.map((priority, i) => ({ id: `${priority.toLowerCase()}-${i}`, priority, durationMs: DURATION_MS })),
    []
  );
  const { rows, decisions, running, run } = useLabRun(specs, CONCURRENCY, enabled);

  return (
    <Card
      title="Priority ordering"
      subtitle={`6 synthetic resources become eligible at the same instant, with concurrency fixed at ${CONCURRENCY}. A ${DURATION_MS}ms artificial delay (not real network time) stands in for a load, isolating ordering from network variance.`}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12 }}>
        <Button onClick={run} disabled={running}>
          {running ? "Running…" : "Run"}
        </Button>
        <Toggle label="Scheduler enabled" checked={enabled} onChange={setEnabled} />
        {rows.length > 0 && !running && (
          <Button
            variant="secondary"
            onClick={() =>
              downloadJson(
                buildLabExport({
                  scenario: "priority-ordering",
                  schedulerEnabled: enabled,
                  configuration: { concurrency: CONCURRENCY, durationMs: DURATION_MS, priorities: PRIORITIES },
                  timeline: rows,
                  schedulerDecisions: decisions,
                }),
                `react-fastload-priority-lab-${Date.now()}.json`
              )
            }
          >
            Export JSON
          </Button>
        )}
      </div>
      {rows.length > 0 && (
        <>
          <Timeline rows={rows} scaleMs={DURATION_MS * 3} />
          <div style={{ marginTop: 12 }}>
            <SchedulerPanel resources={rows.map(rowToFakeRecord)} decisions={decisions} configuredConcurrency={CONCURRENCY} />
          </div>
        </>
      )}
      {!enabled && rows.length > 0 && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          Scheduler disabled: all 6 started at 0ms regardless of priority — nothing coordinated them.
        </p>
      )}
    </Card>
  );
}

// SchedulerPanel only reads `.id` / `.priority` / `.state` from each
// record for its counts — the lab's TimelineRow already carries all
// three, so this is a narrow, honest adapter rather than fabricating a
// full ResourceRecord with made-up fields.
function rowToFakeRecord(r: TimelineRow): Pick<ResourceRecord, "id" | "priority" | "state"> {
  return { id: r.id, priority: r.priority, state: r.state };
}
