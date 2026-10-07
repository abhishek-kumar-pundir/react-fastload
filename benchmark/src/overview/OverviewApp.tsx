import React, { useCallback, useEffect, useState } from "react";
import ScenarioLabPage from "../lab/ScenarioLabPage";
import { Workbench } from "./Workbench";
import { GITHUB_URL, NPM_URL, TITLE_BY_VIEW } from "./site";
import "./overview.css";

export type ShellView = "overview" | "lab" | "raw";

const TABS: Array<{ view: ShellView; label: string }> = [
  { view: "overview", label: "Overview" },
  { view: "lab", label: "Scenarios" },
  { view: "raw", label: "Raw Data" },
];

function readPresentation(): boolean {
  return new URLSearchParams(window.location.search).get("present") === "1";
}

function hrefFor(view: ShellView, present: boolean): string {
  const params = new URLSearchParams();
  params.set("mode", view);
  if (present && view === "overview") params.set("present", "1");
  return `?${params.toString()}`;
}

function BrandMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#171c25" />
      <rect x="6" y="7" width="12" height="3.2" rx="1.6" fill="#ef4444" />
      <rect x="6" y="12" width="16" height="3.2" rx="1.6" fill="#f97316" />
      <rect x="10" y="17" width="14" height="3.2" rx="1.6" fill="#eab308" />
      <rect x="14" y="22" width="12" height="3.2" rx="1.6" fill="#3b82f6" />
    </svg>
  );
}

/**
 * The dashboard shell: top bar, tabs, presentation-mode toggle, footer.
 * Tabs are real links (so they work without JS state and can be shared)
 * that switch views client-side — the Overview's run state survives a
 * trip to Raw Data. Presentation mode only changes what is shown.
 */
export function OverviewApp({ initialView }: { initialView: ShellView }) {
  const [view, setView] = useState<ShellView>(initialView);
  const [presentation, setPresentation] = useState<boolean>(readPresentation);

  useEffect(() => {
    document.title = TITLE_BY_VIEW[view];
  }, [view]);

  useEffect(() => {
    const onPop = () => {
      const m = new URLSearchParams(window.location.search).get("mode");
      setView(m === "lab" || m === "raw" ? m : "overview");
      setPresentation(readPresentation());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const go = useCallback(
    (next: ShellView) => (e: React.MouseEvent) => {
      // Let modified clicks (new tab etc.) behave like normal links.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      window.history.pushState(null, "", hrefFor(next, presentation));
      setView(next);
      window.scrollTo(0, 0);
    },
    [presentation]
  );

  const togglePresentation = () => {
    const next = !presentation;
    setPresentation(next);
    window.history.replaceState(null, "", hrefFor(view, next));
    window.scrollTo(0, 0);
  };

  const presenting = presentation && view === "overview";

  return (
    <div className="rfl">
      <a className="rfl-skip" href="#main">
        Skip to content
      </a>

      <header className="rfl-top">
        <div className="rfl-wrap rfl-top-inner">
          <a className="rfl-brand" href={hrefFor("overview", presentation)} onClick={go("overview")} aria-label="ReactFastLoad, Overview">
            <BrandMark />
            ReactFastLoad
          </a>
          {!presenting && (
            <nav className="rfl-tabs" aria-label="Benchmark views">
              {TABS.map((t) => (
                <a
                  key={t.view}
                  className="rfl-tab"
                  href={hrefFor(t.view, presentation)}
                  aria-current={view === t.view ? "page" : undefined}
                  onClick={go(t.view)}
                >
                  {t.label}
                </a>
              ))}
            </nav>
          )}
          <div className="rfl-top-links">
            {view === "overview" && (
              <button type="button" className="rfl-btn" aria-pressed={presentation} onClick={togglePresentation}>
                Presentation Mode
              </button>
            )}
            <a className="rfl-btn rfl-hide-sm" href={GITHUB_URL} rel="noopener">
              GitHub
            </a>
            <a className="rfl-btn rfl-hide-sm" href={NPM_URL} rel="noopener">
              npm
            </a>
          </div>
        </div>
      </header>

      {/* Kept mounted (hidden) while the Scenario Lab is shown so a finished run is not lost. */}
      <div hidden={view === "lab"}>
        <Workbench view={view === "raw" ? "raw" : "overview"} presentation={presenting} />
      </div>

      {view === "lab" && (
        <main id="main" className="rfl-main">
          <div className="rfl-wrap">
            <ScenarioLabPage />
          </div>
        </main>
      )}

      <footer className="rfl-foot">
        <div className="rfl-wrap rfl-foot-inner">
          <span>ReactFastLoad is open source (MIT). Package name: react-fastload.</span>
          <nav aria-label="Project links">
            <a href={GITHUB_URL}>GitHub</a>
            <a href={NPM_URL}>npm</a>
            <a href="?mode=baseline&scenario=heavy">Real-page benchmark</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
