import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LoadManager } from "../core/LoadManager";
import { MetricsCollector } from "../metrics/MetricsCollector";
import type { FastLoadDebugSnapshot } from "../core/types";

export interface FastLoadContextValue {
  loadManager: LoadManager;
  metricsCollector: MetricsCollector;
  debug: boolean;
}

const FastLoadContext = createContext<FastLoadContextValue | null>(null);

export interface FastLoadProviderProps {
  children: React.ReactNode;
  /**
   * "adaptive" (default) lets the scheduler weigh viewport distance,
   * connection quality, and priority together. "eager" raises the
   * effective floor so more resources load sooner (useful for
   * low-resource-count pages where deferral has little benefit).
   * "conservative" is the inverse — favors deferring anything not
   * CRITICAL/HIGH, useful for resource-heavy pages on constrained devices.
   */
  strategy?: "adaptive" | "eager" | "conservative";
  preloadDistance?: number;
  concurrency?: number;
  /** Enables the developer debug overlay/console reporting described in the docs. */
  debug?: boolean;
}

const STRATEGY_CONCURRENCY: Record<NonNullable<FastLoadProviderProps["strategy"]>, number> = {
  adaptive: 4,
  eager: 8,
  conservative: 2,
};

/**
 * FastLoadProvider initializes the resource registry, scheduler, and
 * metrics collector for the subtree, and makes them available to
 * SmartImage/SmartVideo/LazyComponent/hooks via context. There is exactly
 * one LoadManager per provider instance — nesting providers creates
 * independent scheduling domains, which is intentional (e.g. for
 * micro-frontends) but not required for typical use.
 */
export function FastLoadProvider({
  children,
  strategy = "adaptive",
  preloadDistance = 1000,
  concurrency,
  debug = false,
}: FastLoadProviderProps) {
  const loadManagerRef = useRef<LoadManager>();
  if (!loadManagerRef.current) {
    loadManagerRef.current = new LoadManager({
      preloadDistance,
      concurrency: concurrency ?? STRATEGY_CONCURRENCY[strategy],
      debug,
    });
  }

  const metricsCollectorRef = useRef<MetricsCollector>();
  if (!metricsCollectorRef.current) {
    metricsCollectorRef.current = new MetricsCollector(loadManagerRef.current);
  }

  useEffect(() => {
    const manager = loadManagerRef.current!;
    const collector = metricsCollectorRef.current!;
    collector.start();
    return () => {
      collector.stop();
      manager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<FastLoadContextValue>(
    () => ({
      loadManager: loadManagerRef.current!,
      metricsCollector: metricsCollectorRef.current!,
      debug,
    }),
    [debug]
  );

  return (
    <FastLoadContext.Provider value={value}>
      {children}
      {debug && <FastLoadDebugPanel />}
    </FastLoadContext.Provider>
  );
}

export function useFastLoadContext(): FastLoadContextValue {
  const ctx = useContext(FastLoadContext);
  if (!ctx) {
    throw new Error(
      "react-fastload: this hook/component must be used inside a <FastLoadProvider>."
    );
  }
  return ctx;
}

/**
 * A minimal, dependency-free debug panel. It intentionally does not try to
 * be a full devtools experience — its job is to make the scheduler's
 * decisions visible during development, per the "developer debug mode"
 * requirement, not to be a polished product surface.
 */
function FastLoadDebugPanel() {
  const { loadManager } = useFastLoadContext();
  const [snapshot, setSnapshot] = useState<FastLoadDebugSnapshot>(() => loadManager.getDebugSnapshot());

  useEffect(() => {
    const unsubscribe = loadManager.registry.subscribe(() => {
      setSnapshot(loadManager.getDebugSnapshot());
    });
    const interval = setInterval(() => setSnapshot(loadManager.getDebugSnapshot()), 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [loadManager]);

  // `process` is a Node/bundler global, not a browser one — Vite, webpack,
  // and Next.js all define process.env.NODE_ENV for compatibility, but a
  // consumer using this library via a bare ESM <script> with no bundler
  // (or any environment that doesn't polyfill `process`) would hit a
  // ReferenceError here. Our own tests run under Vitest (Node), where
  // `process` is a real global, so this was invisible until audited.
  const isProduction = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  if (isProduction) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 999999,
        maxWidth: 360,
        maxHeight: 320,
        overflow: "auto",
        background: "rgba(17, 17, 17, 0.92)",
        color: "#e6e6e6",
        fontFamily: "monospace",
        fontSize: 11,
        borderRadius: 8,
        padding: 10,
        lineHeight: 1.4,
      }}
      data-testid="fastload-debug-panel"
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>react-fastload debug</div>
      <div>connection: {snapshot.connection.effectiveType ?? "unknown"} (saveData: {String(snapshot.connection.saveData)})</div>
      <div style={{ marginTop: 6 }}>resources ({snapshot.resources.length})</div>
      {snapshot.resources.map((r) => (
        <div key={r.id} style={{ opacity: r.state === "loaded" ? 0.6 : 1 }}>
          [{r.priority}] {r.id} — {r.state}
          {r.deferred ? " (deferred)" : ""}
          {r.prefetched ? " (prefetched)" : ""}
        </div>
      ))}
      <div style={{ marginTop: 6 }}>recent decisions</div>
      {snapshot.decisions.slice(-8).map((d, i) => (
        <div key={i}>
          {d.action} {d.resourceId}: {d.reason}
        </div>
      ))}
    </div>
  );
}
