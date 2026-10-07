import React, { useMemo, useState } from "react";
import { SCENARIOS } from "../data";
import { buildUrl } from "../url";
import { buildLabExport, downloadJson } from "../lab/exportResults";
import { About } from "./About";
import { deriveOverviewMetrics, timelineScaleMs } from "./deriveMetrics";
import {
  ConcurrencyCard,
  DecisionLog,
  MetricStrip,
  PriorityCard,
  RawMeasurementsTable,
  SchedulingTimeline,
  StatusIndicator,
  TimelineLegend,
  type RunStatus,
} from "./parts";
import { EMPTY_SESSION, Runner, type Session } from "./Runner";
import { OVERVIEW_SCENARIOS, SCENARIO_ORDER, plannedSpanMs, type OverviewScenarioId } from "./scenarios";
import { GITHUB_URL, NPM_URL } from "./site";

const MAX_CONCURRENCY = 8;

/**
 * Owns the Overview's configuration and the current run's session.
 * Rendered for both the Overview and Raw Data views so a run survives
 * switching between them. All numbers shown come from the Scenario Lab's
 * own `useLabRun` hook (via <Runner>) — this component only lays them out.
 */
export function Workbench({ view, presentation }: { view: "overview" | "raw"; presentation: boolean }) {
  const [scenarioId, setScenarioId] = useState<OverviewScenarioId>("priority");
  const scenario = OVERVIEW_SCENARIOS[scenarioId];
  const [concurrency, setConcurrency] = useState(scenario.defaultConcurrency);
  const [enabled, setEnabled] = useState(true);
  const [session, setSession] = useState<Session>(EMPTY_SESSION);

  const specs = useMemo(() => scenario.buildSpecs(), [scenario]);

  // Any configuration change mounts a fresh Runner (see key below) and clears
  // the displayed session in the same update, so results always belong to
  // the configuration currently shown.
  const resetSession = () => setSession(EMPTY_SESSION);
  const changeScenario = (id: OverviewScenarioId) => {
    resetSession();
    setScenarioId(id);
    setConcurrency(OVERVIEW_SCENARIOS[id].defaultConcurrency);
  };
  const changeConcurrency = (value: number) => {
    resetSession();
    setConcurrency(Math.min(MAX_CONCURRENCY, Math.max(1, Math.round(value) || 1)));
  };
  const changeEnabled = (value: boolean) => {
    resetSession();
    setEnabled(value);
  };

  const { rows, decisions, running } = session;
  const status: RunStatus = running ? "running" : rows.length > 0 ? "completed" : "ready";
  const hasRun = rows.length > 0;
  const metrics = useMemo(() => deriveOverviewMetrics(rows), [rows]);
  const planned = plannedSpanMs(specs.length, scenario.durationMs, concurrency, enabled);
  const scaleMs = timelineScaleMs(planned, metrics.lastObservedMs);

  const exportJson = () =>
    downloadJson(
      buildLabExport({
        scenario: scenario.exportName,
        schedulerEnabled: enabled,
        configuration: scenario.exportConfiguration(concurrency),
        timeline: rows,
        schedulerDecisions: decisions,
      }),
      `react-fastload-overview-${scenario.exportName}-${Date.now()}.json`
    );

  const runLabel = running ? "Running…" : status === "completed" ? "Run Again" : "Run Benchmark";

  return (
    <>
      <Runner
        key={`${scenarioId}|${concurrency}|${enabled}`}
        specs={specs}
        concurrency={concurrency}
        enabled={enabled}
        onSession={setSession}
      />

      {view === "overview" ? renderOverview() : renderRaw()}
    </>
  );

  // Plain render functions (not nested components) so React keeps the DOM —
  // open <details>, input focus — stable across re-renders.

  /* ------------------------------------------------------------- overview */
  function renderOverview() {
    return (
      <main id="main" className={`rfl-main${presentation ? " rfl-present" : ""}`}>
        <div className="rfl-wrap">
          <section className="rfl-hero" aria-labelledby="rfl-hero-title">
            <div>
              <h1 id="rfl-hero-title">ReactFastLoad</h1>
              <p className="rfl-tagline">Adaptive resource-loading scheduler for React</p>
              <p className="rfl-lede">
                Visualize priority scheduling, concurrency, viewport preloading, and resource lifecycle behavior. Timestamps come
                from the real scheduler running in your browser; each load is a fixed artificial delay, so ordering is not buried
                in network noise.
              </p>
              {presentation && (
                <p className="rfl-brandline">
                  npm install react-fastload · github.com/abhishek-kumar-pundir/react-fastload
                </p>
              )}
            </div>

            <div className="rfl-launcher">
              <div className="rfl-launcher-head">
                <StatusIndicator status={status} />
                {hasRun && !running && !presentation && (
                  <button type="button" className="rfl-btn" onClick={exportJson}>
                    Export JSON
                  </button>
                )}
              </div>

              {presentation ? (
                <p className="rfl-present-scenario">
                  {scenario.label}{" "}
                  <span className="mono">
                    · {specs.length} resources · {enabled ? `concurrency ${concurrency}` : "scheduler disabled"}
                  </span>
                </p>
              ) : (
                <div className="rfl-fields">
                  <label className="rfl-field">
                    Scenario
                    <select
                      value={scenarioId}
                      disabled={running}
                      onChange={(e) => changeScenario(e.target.value as OverviewScenarioId)}
                    >
                      {SCENARIO_ORDER.map((id) => (
                        <option key={id} value={id}>
                          {OVERVIEW_SCENARIOS[id].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="rfl-field">
                    Concurrency
                    <input
                      type="number"
                      min={1}
                      max={MAX_CONCURRENCY}
                      value={concurrency}
                      disabled={running || !enabled}
                      onChange={(e) => changeConcurrency(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}

              <button type="button" className="rfl-btn rfl-btn-primary" disabled={running || !session.ready} onClick={session.run}>
                {runLabel}
              </button>
              {!presentation && <p className="rfl-launcher-note">{scenario.summary}</p>}
            </div>
          </section>

          <MetricStrip
            metrics={metrics}
            status={status}
            plannedResources={specs.length}
            concurrency={concurrency}
            schedulerEnabled={enabled}
          />

          <div className="rfl-grid">
            <section className="rfl-card" aria-labelledby="rfl-timeline-h">
              <div className="rfl-card-head">
                <h2 id="rfl-timeline-h">Scheduling timeline</h2>
                <span className="rfl-card-sub">
                  {scenario.label} · {specs.length} resources · {scenario.durationMs} ms artificial delay each
                </span>
              </div>
              <SchedulingTimeline
                rows={rows}
                ghost={specs}
                scaleMs={scaleMs}
                lastObservedMs={metrics.lastObservedMs}
                large={presentation}
              />
              <TimelineLegend />
            </section>

            <div className="rfl-rail">
              <PriorityCard specs={specs} rows={rows} decisions={decisions} schedulerEnabled={enabled} hasRun={hasRun} />
              <ConcurrencyCard rows={rows} metrics={metrics} concurrency={concurrency} schedulerEnabled={enabled} hasRun={hasRun} />
            </div>
          </div>

          {!presentation && (
            <div className="rfl-sections">
              <details className="rfl-details">
                <summary>
                  <span className="rfl-summary-text">
                    Configuration
                    <span className="rfl-summary-hint">scheduler on/off and fixed parameters</span>
                  </span>
                </summary>
                <div className="rfl-details-body">
                  <label className="rfl-check">
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={running}
                      onChange={(e) => changeEnabled(e.target.checked)}
                    />
                    <span>
                      Scheduler enabled
                      <br />
                      <span className="rfl-card-sub">
                        Off = no LoadManager at all: every resource starts at 0 ms with no queueing, which is what happens when
                        nothing coordinates loading. This compares scheduling behavior only, not network behavior.
                      </span>
                    </span>
                  </label>
                  <dl className="rfl-kv">
                    <dt>Loader</dt>
                    <dd>Synthetic: a fixed {scenario.durationMs} ms delay stands in for a network request</dd>
                    <dt>Registration</dt>
                    <dd>Every resource registered as eager (immediately eligible, no viewport gating)</dd>
                    <dt>Preload distance</dt>
                    <dd>1000 px, fixed by the harness (not used by eager resources)</dd>
                    <dt>Changing settings</dt>
                    <dd>Clears the current results; each run starts from a fresh scheduler</dd>
                  </dl>
                </div>
              </details>

              <details className="rfl-details">
                <summary>
                  <span className="rfl-summary-text">
                    Raw Measurements
                    <span className="rfl-summary-hint">{hasRun ? `${rows.length} resources` : "per-resource scheduler timestamps"}</span>
                  </span>
                </summary>
                <div className="rfl-details-body">
                  <RawMeasurementsTable rows={rows} />
                </div>
              </details>

              <details className="rfl-details">
                <summary>
                  <span className="rfl-summary-text">
                    Scheduler Details
                    <span className="rfl-summary-hint">{decisions.length ? `${decisions.length} decisions` : "decision log"}</span>
                  </span>
                </summary>
                <div className="rfl-details-body">
                  <DecisionLog decisions={decisions} limit={12} />
                </div>
              </details>
            </div>
          )}

          {!presentation && <About />}
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------- raw data */
  function renderRaw() {
    return (
      <main id="main" className="rfl-main">
        <div className="rfl-wrap">
          <header className="rfl-page-head">
            <h1>Raw data</h1>
            <p>
              The unprocessed numbers behind the Overview, plus the real-page benchmarks. Scenario: {scenario.label}, {specs.length}{" "}
              resources, {enabled ? `concurrency ${concurrency}` : "scheduler disabled"}. Change the scenario on the Overview and run it
              to populate this page.
            </p>
          </header>

          <section className="rfl-card" aria-labelledby="rfl-raw-h">
            <div className="rfl-card-head">
              <h2 id="rfl-raw-h">Raw Measurements</h2>
              <StatusIndicator status={status} />
            </div>
            <p className="rfl-card-sub">
              Milliseconds since the run started. Queue wait = started − eligible. Values are the scheduler registry's own timestamps.
            </p>
            <div className="rfl-toolbar">
              <button type="button" className="rfl-btn" onClick={exportJson} disabled={!hasRun || running}>
                Export JSON
              </button>
            </div>
            <RawMeasurementsTable rows={rows} />
          </section>

          <section className="rfl-card" style={{ marginTop: 16 }} aria-labelledby="rfl-dec-h">
            <h2 id="rfl-dec-h">Scheduler Details</h2>
            <p className="rfl-card-sub" style={{ marginBottom: 12 }}>
              The scheduler's decision log for this run (it keeps at most the last 200 entries).
            </p>
            <DecisionLog decisions={decisions} />
          </section>

          <section className="rfl-card" style={{ marginTop: 16 }} aria-labelledby="rfl-real-h">
            <h2 id="rfl-real-h">Real-page benchmarks</h2>
            <p className="rfl-card-sub">
              These load real images, video and code-split components in a full page, once as plain browser loading (Baseline) and once
              with ReactFastLoad. Each opens as its own page load, because browser timing is measured from navigation start. The
              repeated-run comparison lives on those pages.
            </p>
            <div className="rfl-bench-links">
              {(Object.keys(SCENARIOS) as Array<keyof typeof SCENARIOS>).map((name) => (
                <div className="rfl-bench-link" key={name}>
                  <h3>{SCENARIOS[name].label}</h3>
                  <p>{SCENARIOS[name].description}</p>
                  <div className="rfl-links">
                    <a className="rfl-btn" href={buildUrl({ mode: "baseline", scenario: name })}>
                      Baseline
                    </a>
                    <a className="rfl-btn" href={buildUrl({ mode: "fastload", scenario: name })}>
                      ReactFastLoad
                    </a>
                    <a className="rfl-btn" href={buildUrl({ mode: "results", scenario: name })}>
                      Results
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <p className="rfl-card-sub" style={{ marginTop: 20 }}>
            Source and package: <a href={GITHUB_URL}>GitHub</a> · <a href={NPM_URL}>npm</a>
          </p>
        </div>
      </main>
    );
  }
}
