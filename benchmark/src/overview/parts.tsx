import React from "react";
import type { Priority, SchedulerDecision } from "react-fastload";
import type { SyntheticSpec, TimelineRow } from "../lab/synthetic";
import type { OverviewMetrics } from "./deriveMetrics";
import { niceTickStep } from "./deriveMetrics";
import { PRIORITY_COLOR, PRIORITY_ORDER, PRIORITY_TEXT, formatMs, formatRawMs } from "./format";

/* Everything in this file is presentational: it renders values it is given
 * and never measures, estimates, or invents anything. */

export type RunStatus = "ready" | "running" | "completed";

/* ------------------------------------------------------------------ status */

export function StatusIndicator({ status }: { status: RunStatus }) {
  const label = status === "ready" ? "Ready" : status === "running" ? "Running" : "Completed";
  return (
    <span className="rfl-status" role="status" aria-live="polite">
      <span className="rfl-status-icon" aria-hidden="true">
        {status === "ready" && (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="4.5" fill="none" stroke="#8f99ab" strokeWidth="1.5" />
          </svg>
        )}
        {status === "running" && (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="6" fill="none" stroke="#e8ecf3" strokeOpacity="0.35" strokeWidth="1.5" />
            <circle cx="7" cy="7" r="3.5" fill="#e8ecf3" />
          </svg>
        )}
        {status === "completed" && (
          <svg width="14" height="14" viewBox="0 0 14 14">
            <path d="M2.5 7.4 5.6 10.5 11.5 3.8" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      {label}
    </span>
  );
}

/* ----------------------------------------------------------------- metrics */

interface MetricCellProps {
  label: string;
  value: string;
  unit?: string;
  sub: string;
  pending?: boolean;
  title?: string;
}

function MetricCell({ label, value, unit, sub, pending, title }: MetricCellProps) {
  return (
    <li className={`rfl-metric${pending ? " rfl-metric-pending" : ""}`} title={title}>
      <div className="rfl-metric-label">{label}</div>
      <div className="rfl-metric-value">
        <span>{value}</span>
        {unit && <span className="rfl-metric-unit">{unit}</span>}
      </div>
      <div className="rfl-metric-sub">{sub}</div>
    </li>
  );
}

export function MetricStrip({
  metrics,
  status,
  plannedResources,
  concurrency,
  schedulerEnabled,
}: {
  metrics: OverviewMetrics;
  status: RunStatus;
  plannedResources: number;
  concurrency: number;
  schedulerEnabled: boolean;
}) {
  const running = status === "running";
  const pendingSub = running ? "measuring…" : "run the benchmark to measure";

  const first = formatMs(metrics.firstDispatchMs);
  const wait = formatMs(metrics.medianQueueWaitMs);
  const span = formatMs(metrics.completionSpanMs);

  return (
    <ul className="rfl-metrics" aria-label="Headline metrics">
      <MetricCell
        label="Resources"
        value={String(metrics.resources || plannedResources)}
        sub={metrics.resources ? "registered with the scheduler" : "in this scenario"}
        title="Count of resources registered for this run."
      />
      <MetricCell
        label="Concurrency"
        value={schedulerEnabled ? String(concurrency) : "None"}
        sub={schedulerEnabled ? "configured limit on simultaneous loads" : "scheduler disabled, no limit applied"}
        title="The concurrency value this run was configured with."
      />
      <MetricCell
        label="First dispatch"
        value={first.value}
        unit={first.unit}
        pending={metrics.firstDispatchMs === null}
        sub={metrics.firstDispatchMs === null ? pendingSub : "run start → first resource started"}
        title="min(startedAt) across resources, in ms since the run started."
      />
      <MetricCell
        label="Median queue wait"
        value={wait.value}
        unit={wait.unit}
        pending={metrics.medianQueueWaitMs === null}
        sub={
          metrics.medianQueueWaitMs === null
            ? pendingSub
            : running
              ? "eligible → started, so far"
              : "eligible → started"
        }
        title="median(startedAt − eligibleAt) across resources that have started."
      />
      <MetricCell
        label="Completion span"
        value={span.value}
        unit={span.unit}
        pending={metrics.completionSpanMs === null}
        sub={metrics.completionSpanMs === null ? pendingSub : "first dispatch → last completion"}
        title="max(completedAt) − min(startedAt). Reported once every resource has finished."
      />
    </ul>
  );
}

/* ---------------------------------------------------------------- timeline */

function fmtNum(ms: number): string {
  return ms.toFixed(1);
}

function pct(ms: number, scaleMs: number): number {
  return Math.max(0, Math.min(100, (ms / scaleMs) * 100));
}

function rowValue(r: TimelineRow): React.ReactNode {
  if (r.startedAtMs === null) return <span>queued</span>;
  if (r.completedAtMs === null) {
    return (
      <>
        <strong>{fmtNum(r.startedAtMs)}</strong> → …
      </>
    );
  }
  return (
    <>
      <strong>{fmtNum(r.startedAtMs)}</strong> → <strong>{fmtNum(r.completedAtMs)}</strong> ms
    </>
  );
}

function describeRow(r: TimelineRow): string {
  const parts = [`${r.id}, priority ${r.priority}`];
  if (r.eligibleAtMs !== null) parts.push(`eligible at ${fmtNum(r.eligibleAtMs)} milliseconds`);
  if (r.startedAtMs !== null) parts.push(`started at ${fmtNum(r.startedAtMs)} milliseconds`);
  if (r.queueWaitMs !== null) parts.push(`queue wait ${fmtNum(r.queueWaitMs)} milliseconds`);
  if (r.completedAtMs !== null) parts.push(`completed at ${fmtNum(r.completedAtMs)} milliseconds`);
  else if (r.startedAtMs === null) parts.push("still queued");
  else parts.push("in flight");
  return parts.join(", ");
}

export function SchedulingTimeline({
  rows,
  ghost,
  scaleMs,
  lastObservedMs,
  large,
}: {
  rows: TimelineRow[];
  ghost: SyntheticSpec[];
  scaleMs: number;
  lastObservedMs: number;
  large: boolean;
}) {
  const stepMs = niceTickStep(scaleMs);
  const stepPct = (stepMs / scaleMs) * 100;
  const ticks: number[] = [];
  for (let t = 0; t <= scaleMs; t += stepMs) ticks.push(t);

  const showGhost = rows.length === 0;
  const trackStyle = { ["--step" as string]: `${stepPct}%` } as React.CSSProperties;

  return (
    <div className={`rfl-tl${showGhost ? " rfl-tl-ghost" : ""}${large ? " rfl-large" : ""}`}>
      <div className="rfl-tl-axis" aria-hidden="true">
        <span>ms from run start</span>
        <div className="rfl-tl-ticks">
          {ticks.map((t) => (
            <span key={t} style={{ left: `${pct(t, scaleMs)}%` }}>
              {t}
            </span>
          ))}
        </div>
        <span />
      </div>

      <ol className="rfl-tl-rows" aria-label="Scheduling timeline, one row per resource">
        {showGhost
          ? ghost.map((s) => (
              <li className="rfl-tl-row" key={s.id}>
                <div className="rfl-tl-id">
                  <span className="rfl-dot" style={{ background: PRIORITY_COLOR[s.priority] }} aria-hidden="true" />
                  <span className="rfl-tl-name">{s.id}</span>
                  <span className="rfl-tl-prio" style={{ color: PRIORITY_TEXT[s.priority] }}>
                    {s.priority}
                  </span>
                </div>
                <div className="rfl-tl-track" style={trackStyle} aria-hidden="true" />
                <div className="rfl-tl-val">—</div>
              </li>
            ))
          : rows.map((r) => {
              const start = r.startedAtMs;
              const end = r.completedAtMs ?? lastObservedMs;
              const inFlight = start !== null && r.completedAtMs === null;
              const eligible = r.eligibleAtMs;
              return (
                <li className="rfl-tl-row" key={r.id}>
                  <div className="rfl-tl-id">
                    <span className="rfl-dot" style={{ background: PRIORITY_COLOR[r.priority] }} aria-hidden="true" />
                    <span className="rfl-tl-name" title={r.id}>
                      {r.id}
                    </span>
                    <span className="rfl-tl-prio" style={{ color: PRIORITY_TEXT[r.priority] }}>
                      {r.priority}
                    </span>
                  </div>
                  <div className="rfl-tl-track" style={trackStyle} role="img" aria-label={describeRow(r)}>
                    {eligible !== null && start !== null && start > eligible && (
                      <div
                        className="rfl-bar rfl-bar-wait"
                        title={`queued ${fmtNum(eligible)} → ${fmtNum(start)} ms`}
                        style={{ left: `${pct(eligible, scaleMs)}%`, width: `${pct(start - eligible, scaleMs)}%` }}
                      />
                    )}
                    {eligible !== null && start === null && (
                      <div className="rfl-tl-marker" title={`eligible at ${fmtNum(eligible)} ms, not started`} style={{ left: `${pct(eligible, scaleMs)}%` }} />
                    )}
                    {start !== null && (
                      <div
                        className={`rfl-bar${inFlight ? " rfl-bar-inflight" : ""}`}
                        title={`${r.priority}: started ${fmtNum(start)} ms${r.completedAtMs !== null ? `, completed ${fmtNum(r.completedAtMs)} ms` : ", in flight"}`}
                        style={{
                          left: `${pct(start, scaleMs)}%`,
                          width: `${pct(Math.max(end - start, 0), scaleMs)}%`,
                          background: PRIORITY_COLOR[r.priority],
                        }}
                      />
                    )}
                  </div>
                  <div className="rfl-tl-val">{rowValue(r)}</div>
                </li>
              );
            })}
      </ol>

      {showGhost && (
        <div className="rfl-tl-empty">
          <span>Run the benchmark to record each resource's real timestamps.</span>
        </div>
      )}
    </div>
  );
}

export function TimelineLegend() {
  return (
    <div className="rfl-legend" aria-label="Timeline legend">
      <span>
        <i className="rfl-swatch rfl-bar-wait" aria-hidden="true" /> Waiting in the queue (eligible → started)
      </span>
      <span>
        <i className="rfl-swatch rfl-swatch-priority" aria-hidden="true" /> Loading (colored by priority)
      </span>
      <span>
        <i className="rfl-swatch" style={{ background: "var(--text)", opacity: 0.5 }} aria-hidden="true" /> In flight (still loading)
      </span>
    </div>
  );
}

/* -------------------------------------------------------- priority visual */

export function PriorityCard({
  specs,
  rows,
  decisions,
  schedulerEnabled,
  hasRun,
}: {
  specs: SyntheticSpec[];
  rows: TimelineRow[];
  decisions: SchedulerDecision[];
  schedulerEnabled: boolean;
  hasRun: boolean;
}) {
  const priorityById = new Map<string, Priority>();
  specs.forEach((s) => priorityById.set(s.id, s.priority));
  rows.forEach((r) => priorityById.set(r.id, r.priority));

  const dispatched = decisions.filter((d) => d.action === "load").map((d) => d.resourceId);
  const counts = new Map<Priority, number>();
  specs.forEach((s) => counts.set(s.priority, (counts.get(s.priority) ?? 0) + 1));

  return (
    <section className="rfl-card" aria-labelledby="rfl-priority-h">
      <h2 id="rfl-priority-h">Priority order</h2>
      <p className="rfl-card-sub">Higher priority is dispatched first when slots are limited.</p>
      <ol className="rfl-chain" aria-label="Priority levels from highest to lowest">
        {PRIORITY_ORDER.map((p) => (
          <li key={p}>
            <span className="rfl-chip" style={{ color: PRIORITY_TEXT[p] }} title={`${counts.get(p) ?? 0} resource(s) at this priority in this scenario`}>
              <span className="rfl-dot" style={{ background: PRIORITY_COLOR[p] }} aria-hidden="true" />
              {p}
            </span>
          </li>
        ))}
      </ol>

      <div className="rfl-subhead">Dispatch order (from scheduler decisions)</div>
      {!hasRun && <p className="rfl-note">Run the benchmark to record the order in which the scheduler dispatched each resource.</p>}
      {hasRun && !schedulerEnabled && (
        <p className="rfl-note">Scheduler disabled: nothing coordinated these resources, so there are no dispatch decisions and priority has no effect.</p>
      )}
      {hasRun && schedulerEnabled && dispatched.length === 0 && <p className="rfl-note">No dispatch decisions recorded yet.</p>}
      {dispatched.length > 0 && (
        <ol className="rfl-order">
          {dispatched.map((id, i) => {
            const p = priorityById.get(id);
            return (
              <li key={id}>
                <span className="n">{i + 1}</span>
                <span className="rfl-dot" style={{ background: p ? PRIORITY_COLOR[p] : "var(--p-idle)" }} aria-hidden="true" />
                <span>{id}</span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------ concurrency visual */

export function ConcurrencyCard({
  rows,
  metrics,
  concurrency,
  schedulerEnabled,
  hasRun,
}: {
  rows: TimelineRow[];
  metrics: OverviewMetrics;
  concurrency: number;
  schedulerEnabled: boolean;
  hasRun: boolean;
}) {
  const slotCount = schedulerEnabled ? concurrency : Math.max(metrics.resources, 1);
  const queuedRows = rows.filter((r) => r.state === "eligible");

  return (
    <section className="rfl-card" aria-labelledby="rfl-conc-h">
      <h2 id="rfl-conc-h">Concurrency</h2>
      <p className="rfl-card-sub">
        {schedulerEnabled ? "Active loads against the configured limit." : "Scheduler disabled: every resource starts at once."}
      </p>

      <div className="rfl-slots" role="img" aria-label={`${metrics.active} of ${schedulerEnabled ? concurrency : "unlimited"} slots active`}>
        {Array.from({ length: slotCount }, (_, i) => (
          <span key={i} className="rfl-slot" data-on={i < metrics.active ? "true" : "false"} />
        ))}
      </div>
      <div className="rfl-slot-count">
        {schedulerEnabled ? `${metrics.active} / ${concurrency}` : `${metrics.active} / ${metrics.resources || "—"}`}
        <span>active</span>
      </div>

      <div className="rfl-subhead">
        Queued ({queuedRows.length}) · Completed ({metrics.completed}
        {metrics.resources ? ` / ${metrics.resources}` : ""})
      </div>
      <div className="rfl-queue" aria-live="off">
        {queuedRows.length === 0 && (
          <span className="rfl-queue-empty">{hasRun ? "Nothing waiting for a slot." : "Nothing queued yet."}</span>
        )}
        {queuedRows.map((r) => (
          <span className="rfl-queue-item" key={r.id}>
            <span className="rfl-dot" style={{ background: PRIORITY_COLOR[r.priority] }} aria-hidden="true" />
            {r.id}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ raw sections */

export function RawMeasurementsTable({ rows }: { rows: TimelineRow[] }) {
  if (rows.length === 0) {
    return <p className="rfl-empty">No measurements yet. Run the benchmark from the Overview.</p>;
  }
  return (
    <div className="rfl-table-wrap">
      <table className="rfl-table">
        <caption className="rfl-sr">
          Raw per-resource scheduler timestamps in milliseconds since the run started
        </caption>
        <thead>
          <tr>
            <th scope="col">Resource</th>
            <th scope="col">Priority</th>
            <th scope="col" className="num">Eligible</th>
            <th scope="col" className="num">Started</th>
            <th scope="col" className="num">Completed</th>
            <th scope="col" className="num">Queue wait</th>
            <th scope="col">State</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td style={{ color: PRIORITY_TEXT[r.priority] }}>{r.priority}</td>
              <td className="num">{formatRawMs(r.eligibleAtMs)}</td>
              <td className="num">{formatRawMs(r.startedAtMs)}</td>
              <td className="num">{formatRawMs(r.completedAtMs)}</td>
              <td className="num">{formatRawMs(r.queueWaitMs)}</td>
              <td>{r.state}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DecisionLog({ decisions, limit }: { decisions: SchedulerDecision[]; limit?: number }) {
  const shown = (limit ? decisions.slice(-limit) : decisions.slice()).reverse();
  return (
    <div>
      <div className="rfl-subhead" style={{ marginTop: 0, marginBottom: 8 }}>
        Recent scheduler decisions
      </div>
      {shown.length === 0 ? (
        <p className="rfl-empty">No decisions yet.</p>
      ) : (
        <ul className="rfl-log" aria-label="Recent scheduler decisions, newest first">
          {shown.map((d, i) => (
            <li key={`${d.resourceId}-${d.action}-${d.timestamp}-${i}`}>
              <span className="act">{d.action}</span>
              <span>{d.resourceId}</span>
              <span className="why" title={d.reason}>
                {d.reason}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
