import React, { useState } from "react";
import BaselinePage from "./BaselinePage";
import FastLoadPage from "./FastLoadPage";
import ResultsPage from "./ResultsPage";
import { OverviewApp } from "./overview/OverviewApp";
import { getMode, getScenario, buildUrl } from "./url";
import { clearRuns } from "./runHarness";
import { SCENARIOS, type ScenarioName } from "./data";

/**
 * Mode switch is a full navigation (not client-side state) on purpose:
 * Navigation/Resource/Paint Timing and LCP/CLS are all measured from
 * navigation start, so comparing modes fairly requires each to get its
 * own fresh page load rather than swapping content in place.
 */
export default function App() {
  const mode = getMode();
  const scenario = getScenario();

  if (mode === "results") return <ResultsPage />;
  if (mode === "overview" || mode === "lab" || mode === "raw") {
    return <OverviewApp initialView={mode} />;
  }

  return (
    <div>
      <Controls mode={mode} scenario={scenario} />
      {mode === "baseline" ? <BaselinePage /> : <FastLoadPage />}
    </div>
  );
}

function Controls({ mode, scenario }: { mode: "baseline" | "fastload"; scenario: ScenarioName }) {
  const [runCount, setRunCount] = useState(10);
  const isAuto = new URLSearchParams(window.location.search).get("auto") === "1";

  if (isAuto) {
    // Hide manual controls during an automated run sequence so nothing
    // interferes with the navigation chain.
    return (
      <div style={{ padding: 8, background: "#222", color: "#eee", fontSize: 12 }}>
        Auto-run in progress for scenario "{scenario}" — do not navigate away.
      </div>
    );
  }

  return (
    <nav style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", padding: 12, borderBottom: "1px solid #333" }}>
      {(Object.keys(SCENARIOS) as ScenarioName[]).map((name) => (
        <a
          key={name}
          href={buildUrl({ mode, scenario: name })}
          style={{ fontWeight: scenario === name ? 700 : 400 }}
          title={SCENARIOS[name].description}
        >
          {SCENARIOS[name].label}
        </a>
      ))}
      <span style={{ opacity: 0.4 }}>|</span>
      <a href={buildUrl({ mode: "baseline", scenario })} style={{ fontWeight: mode === "baseline" ? 700 : 400 }}>
        Baseline
      </a>
      <a href={buildUrl({ mode: "fastload", scenario })} style={{ fontWeight: mode === "fastload" ? 700 : 400 }}>
        ReactFastLoad
      </a>
      <span style={{ opacity: 0.4 }}>|</span>
      <label>
        Runs:{" "}
        <input
          type="number"
          min={1}
          max={30}
          value={runCount}
          onChange={(e) => setRunCount(Number(e.target.value) || 1)}
          style={{ width: 48 }}
        />
      </label>
      <button
        onClick={() => {
          clearRuns(scenario);
          window.location.href = buildUrl({ mode: "baseline", scenario, auto: true, run: 1, totalRuns: runCount });
        }}
      >
        Start {runCount}-run comparison
      </button>
      <a href={buildUrl({ mode: "results", scenario })}>View results</a>
      <span style={{ opacity: 0.4 }}>|</span>
      <a href={buildUrl({ mode: "overview" })}>← Overview</a>
      <a href={buildUrl({ mode: "lab" })}>Scenario Lab</a>
    </nav>
  );
}
