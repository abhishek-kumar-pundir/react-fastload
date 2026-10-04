import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { FastLoadProvider, useFastLoadContext } from "../../src/components/FastLoadProvider";
import { SmartVideo } from "../../src/components/SmartVideo";
import { lazyComponent } from "../../src/components/LazyComponent";

// Regression test for a real bug caught during benchmarking: SmartVideo and
// lazyComponent registered resources without ever passing estimatedSize
// through to the registry, so bytesDeferred silently stayed 0 for any
// page whose only deferred resources were video/components.

class FakeIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function RegistryProbe({ id, onRead }: { id: string; onRead: (size: number | undefined) => void }) {
  const { loadManager } = useFastLoadContext();
  React.useEffect(() => {
    const unsub = loadManager.registry.subscribe(() => {
      const record = loadManager.registry.get(id);
      if (record) onRead(record.estimatedSize);
    });
    const record = loadManager.registry.get(id);
    if (record) onRead(record.estimatedSize);
    return unsub;
  }, [loadManager, id, onRead]);
  return null;
}

describe("estimatedSize plumbing", () => {
  beforeEach(() => {
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
  });

  it("SmartVideo registers its estimatedSize", async () => {
    let observed: number | undefined;
    render(
      <FastLoadProvider>
        <SmartVideo
          src="/clip.mp4"
          resourceId="clip"
          priority="LOW"
          strategy="lazy"
          estimatedSize={18_000_000}
        />
        <RegistryProbe id="clip" onRead={(size) => (observed = size)} />
      </FastLoadProvider>
    );

    await waitFor(() => expect(observed).toBe(18_000_000));
  });

  it("lazyComponent registers its estimatedSize", async () => {
    let observed: number | undefined;
    const Widget = lazyComponent(() => Promise.resolve({ default: () => <div /> }), {
      resourceId: "widget",
      priority: "LOW",
      strategy: "lazy",
      estimatedSize: 94_000,
    });

    render(
      <FastLoadProvider>
        <Widget />
        <RegistryProbe id="widget" onRead={(size) => (observed = size)} />
      </FastLoadProvider>
    );

    await waitFor(() => expect(observed).toBe(94_000));
  });
});
