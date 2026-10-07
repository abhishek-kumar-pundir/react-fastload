import React, { useEffect, useMemo, useRef, useState } from "react";
import { LoadManager, type ResourceRecord } from "react-fastload";
import { Card, NumberField, Button } from "./ui";
import { createSyntheticLoader } from "./synthetic";

const BLOCK_COUNT = 10;
const BLOCK_HEIGHT = 140;
const LOAD_DURATION_MS = 150;

/**
 * A REAL (not synthetic-timing) demonstration: 10 blocks in a scrollable
 * container, each registered with strategy="lazy" against the actual
 * shared IntersectionObserver via `LoadManager.observeViewport()`. Scroll
 * the container and watch each block's live state/distance change as it
 * crosses the configured preload distance — this is the real scheduler
 * reacting to real browser geometry, not a staged animation.
 */
export function ViewportLab() {
  const [preloadDistance, setPreloadDistance] = useState(150);
  const [resetKey, setResetKey] = useState(0);
  const managerRef = useRef<LoadManager | null>(null);
  const [records, setRecords] = useState<ResourceRecord[]>([]);

  const blockIds = useMemo(() => Array.from({ length: BLOCK_COUNT }, (_, i) => `block-${i}`), []);

  useEffect(() => {
    const manager = new LoadManager({ preloadDistance });
    managerRef.current = manager;

    for (const id of blockIds) {
      manager.register({ id, type: "other", priority: "NORMAL", strategy: "lazy" });
      manager.setLoader(id, createSyntheticLoader(LOAD_DURATION_MS));
    }
    const unsubscribe = manager.registry.subscribe(setRecords);
    setRecords(manager.registry.all());

    return () => {
      unsubscribe();
      manager.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadDistance, resetKey]);

  return (
    <Card
      title="Viewport-aware preloading"
      subtitle={`${BLOCK_COUNT} blocks in a scrollable container, each a real registered resource (strategy="lazy"). Scroll to watch each one become eligible once it's within ${preloadDistance}px of the viewport, using the real shared IntersectionObserver — nothing here is staged.`}
    >
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", marginBottom: 12 }}>
        <NumberField label="Preload distance (px)" value={preloadDistance} onChange={setPreloadDistance} min={0} max={1000} />
        <Button onClick={() => setResetKey((k) => k + 1)}>Reset</Button>
      </div>

      <div
        style={{
          height: 320,
          overflowY: "auto",
          border: "1px solid #262626",
          borderRadius: 8,
          background: "#0e0e0e",
        }}
      >
        {blockIds.map((id) => {
          const record = records.find((r) => r.id === id);
          return <ViewportBlock key={id} id={id} record={record} manager={managerRef.current} />;
        })}
      </div>
    </Card>
  );
}

const STATE_COLOR: Record<string, string> = {
  idle: "#3f3f46",
  eligible: "#eab308",
  loading: "#3b82f6",
  loaded: "#22c55e",
  error: "#ef4444",
};

// Memoized because `records` is one array covering all 10 blocks — without
// this, any single block's state change re-renders (and re-subscribes the
// ref callback for) all 10, even though unchanged records keep the same
// object reference and so would otherwise be skipped by memo.
const ViewportBlock = React.memo(function ViewportBlock({
  id,
  record,
  manager,
}: {
  id: string;
  record: ResourceRecord | undefined;
  manager: LoadManager | null;
}) {
  const unobserveRef = useRef<(() => void) | undefined>(undefined);

  const ref = (node: HTMLDivElement | null) => {
    unobserveRef.current?.();
    unobserveRef.current = undefined;
    if (node && manager) {
      unobserveRef.current = manager.observeViewport(id, node);
    }
  };

  const state = record?.state ?? "idle";
  const distance = record?.viewportDistance;

  return (
    <div
      ref={ref}
      style={{
        height: BLOCK_HEIGHT,
        borderBottom: "1px solid #1f1f1f",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
        fontFamily: "monospace",
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: STATE_COLOR[state] ?? "#666",
          flexShrink: 0,
        }}
      />
      <div style={{ width: 70 }}>{id}</div>
      <div style={{ width: 70 }}>{state}</div>
      <div style={{ opacity: 0.7 }}>
        {distance != null ? `${Math.round(distance)}px from viewport` : "not yet observed"}
      </div>
    </div>
  );
});
