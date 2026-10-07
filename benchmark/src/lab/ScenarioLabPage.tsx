import React from "react";
import { PriorityLab } from "./PriorityLab";
import { ConcurrencyLab } from "./ConcurrencyLab";
import { ViewportLab } from "./ViewportLab";
import { DedupLab } from "./DedupLab";
import { labTheme } from "./ui";

/**
 * Four controlled, isolated demonstrations of specific scheduler
 * behaviors — distinct from the Light/Heavy/Extreme pages, which measure
 * real network behavior on a realistic page. The Lab trades realism for
 * clarity: synthetic, deterministic timing (or, for the Viewport panel,
 * real browser geometry with a synthetic load) so what you're seeing is
 * provably the scheduler's own behavior, not network luck.
 */
export default function ScenarioLabPage() {
  return (
    <div style={{ padding: 16, maxWidth: 1000, margin: "0 auto", color: labTheme.text }}>
      <h1 style={{ marginBottom: 4 }}>Scenario Lab</h1>
      <p style={{ opacity: 0.75, maxWidth: 720, marginBottom: 20, fontSize: 14 }}>
        Controlled demonstrations of specific scheduler mechanisms, isolated from real network variance using a
        deterministic artificial delay in place of a real fetch (the Viewport panel is the exception — it uses real
        browser scroll/intersection geometry). These show what the scheduler itself does, not real-world page load
        performance — for that, see the{" "}
        <a href="/?mode=baseline&scenario=heavy" style={{ color: "#60a5fa" }}>
          Heavy scenario
        </a>{" "}
        benchmark instead.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <PriorityLab />
        <ConcurrencyLab />
        <ViewportLab />
        <DedupLab />
      </div>
    </div>
  );
}
