import React, { useMemo, useState } from "react";
import { useLabRun } from "./useLabRun";
import { Timeline } from "./Timeline";
import { SchedulerPanel } from "./SchedulerPanel";
import { Card, Button, NumberField, Toggle } from "./ui";
import { computeSpan } from "./derivedMetrics";
import { buildLabExport, downloadJson } from "./exportResults";
import type { SyntheticSpec, TimelineRow } from "./synthetic";
import type { ResourceRecord } from "react-fastload";

export const RESOURCE_COUNT = 8;
export const DURATION_MS = 200;

/**
 * Demonstrates how the configured concurrency cap changes the
 * completion span for the SAME 8 same-priority resources. Lower
 * concurrency = longer span (more queueing), higher = shorter — this is
 * the scheduler's own pacing, not a network effect.
 */
export function ConcurrencyLab() {
  const [concurrency, setConcurrency] = useState(2);
  const [enabled, setEnabled] = useState(true);

  const specs: SyntheticSpec[] = useMemo(
    () => Array.from({ length: RESOURCE_COUNT }, (_, i) => ({ id: `res-${i}`, priority: "NORMAL" as const, durationMs: DURATION_MS })),
    []
  );
  const { rows, decisions, running, run } = useLabRun(specs, concurrency, enabled);

  const span = computeSpan(rows);

  return (
    <Card
      title="Concurrency cap"
      subtitle={`${RESOURCE_COUNT} same-priority resources, each a ${DURATION_MS}ms artificial delay. Changing concurrency changes how many run at once — and therefore the total completion span.`}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 12, flexWrap: "wrap" }}>
        <NumberField label="Concurrency" value={concurrency} onChange={setConcurrency} min={1} max={RESOURCE_COUNT} />
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
                  scenario: "concurrency-cap",
                  schedulerEnabled: enabled,
                  configuration: { concurrency, durationMs: DURATION_MS, resourceCount: RESOURCE_COUNT },
                  timeline: rows,
                  schedulerDecisions: decisions,
                }),
                `react-fastload-concurrency-lab-${Date.now()}.json`
              )
            }
          >
            Export JSON
          </Button>
        )}
      </div>

      {span.completionSpanMs != null && (
        <p style={{ fontSize: 13, marginBottom: 10 }}>
          Completion span: <strong>{Math.round(span.completionSpanMs)}ms</strong> (first start{" "}
          {Math.round(span.firstStartMs ?? 0)}ms → last completion {Math.round(span.lastCompletionMs ?? 0)}ms)
        </p>
      )}

      {rows.length > 0 && (
        <>
          <Timeline rows={rows} scaleMs={(DURATION_MS * RESOURCE_COUNT) / Math.max(1, concurrency) + DURATION_MS} />
          <div style={{ marginTop: 12 }}>
            <SchedulerPanel resources={rows.map(rowToFakeRecord)} decisions={decisions} configuredConcurrency={concurrency} />
          </div>
        </>
      )}
    </Card>
  );
}

function rowToFakeRecord(r: TimelineRow): Pick<ResourceRecord, "id" | "priority" | "state"> {
  return { id: r.id, priority: r.priority, state: r.state };
}
