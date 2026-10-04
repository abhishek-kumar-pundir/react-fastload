import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FastLoadProvider, useFastLoadContext } from "../../src/components/FastLoadProvider";
import { useFastLoadMetrics } from "../../src/hooks/useFastLoadMetrics";

function Consumer() {
  const { loadManager } = useFastLoadContext();
  return <div data-testid="preload-distance">{loadManager.preloadDistance}</div>;
}

function MetricsConsumer() {
  const metrics = useFastLoadMetrics();
  return <div data-testid="initial-requests">{metrics.initialRequests}</div>;
}

describe("FastLoadProvider", () => {
  it("throws a clear error when a hook is used outside the provider", () => {
    function Broken() {
      useFastLoadContext();
      return null;
    }
    expect(() => render(<Broken />)).toThrow(/must be used inside a <FastLoadProvider>/);
  });

  it("provides a LoadManager configured with the given preloadDistance", () => {
    render(
      <FastLoadProvider preloadDistance={750}>
        <Consumer />
      </FastLoadProvider>
    );
    expect(screen.getByTestId("preload-distance").textContent).toBe("750");
  });

  it("renders the debug panel only when debug is enabled", () => {
    const { rerender } = render(
      <FastLoadProvider>
        <div>content</div>
      </FastLoadProvider>
    );
    expect(screen.queryByTestId("fastload-debug-panel")).toBeNull();

    rerender(
      <FastLoadProvider debug>
        <div>content</div>
      </FastLoadProvider>
    );
    // debug panel renders null in production NODE_ENV; in test/dev it should appear.
    if (process.env.NODE_ENV !== "production") {
      expect(screen.queryByTestId("fastload-debug-panel")).not.toBeNull();
    }
  });

  it("useFastLoadMetrics reflects registered resources via context", () => {
    render(
      <FastLoadProvider>
        <MetricsConsumer />
      </FastLoadProvider>
    );
    // No resources registered yet in this test — should read 0, not throw.
    expect(screen.getByTestId("initial-requests").textContent).toBe("0");
  });
});
