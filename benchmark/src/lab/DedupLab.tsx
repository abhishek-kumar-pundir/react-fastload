import React, { useEffect, useRef, useState } from "react";
import { LoadManager, type ResourceRecord } from "react-fastload";
import { Card, Toggle } from "./ui";
import { createSyntheticLoader } from "./synthetic";
import { computeDedupRatio } from "./derivedMetrics";

const SHARED_ID = "shared-resource:/demo.jpg";

/**
 * Three independent "consumers" that can each be toggled on/off, all
 * resolving to the SAME resource id — exactly what SmartImage does by
 * default when two components render the same `src`. Toggling a
 * consumer on calls `manager.register()`; off calls `manager.unregister()`.
 * The registry entry count (always 0 or 1 here) and the real refCount
 * behavior (the entry only disappears once the LAST consumer unregisters)
 * are both read live from the real LoadManager — nothing here is staged.
 */
export function DedupLab() {
  const managerRef = useRef<LoadManager | null>(null);
  const [consumers, setConsumers] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [records, setRecords] = useState<ResourceRecord[]>([]);

  useEffect(() => {
    const manager = new LoadManager({ preloadDistance: 1000 });
    managerRef.current = manager;
    const unsubscribe = manager.registry.subscribe(setRecords);
    return () => {
      unsubscribe();
      manager.destroy();
    };
  }, []);

  const toggleConsumer = (index: number) => {
    const manager = managerRef.current;
    if (!manager) return;

    setConsumers((prev) => {
      const next = [...prev] as [boolean, boolean, boolean];
      next[index] = !prev[index];

      if (next[index]) {
        manager.register({ id: SHARED_ID, type: "image", priority: "NORMAL", strategy: "lazy" });
        manager.setLoader(SHARED_ID, createSyntheticLoader(300));
      } else {
        manager.unregister(SHARED_ID);
      }
      return next;
    });
  };

  const mountCount = consumers.filter(Boolean).length;
  const entry = records.find((r) => r.id === SHARED_ID);
  const uniqueEntries = entry ? 1 : 0;
  const ratio = computeDedupRatio(mountCount, uniqueEntries);

  return (
    <Card
      title="Request deduplication"
      subtitle='Three independent "consumers" below all resolve to the same resource id — exactly what happens when two <SmartImage> use the same src by default. Toggle them on and off.'
    >
      <div style={{ display: "flex", gap: 20, marginBottom: 14 }}>
        {[0, 1, 2].map((i) => (
          <Toggle key={i} label={`Consumer ${i + 1} mounted`} checked={consumers[i]} onChange={() => toggleConsumer(i)} />
        ))}
      </div>

      <div style={{ fontFamily: "monospace", fontSize: 13, display: "flex", gap: 24 }}>
        <div>
          Mounted consumers: <strong>{mountCount}</strong>
        </div>
        <div>
          Real registry entries: <strong>{uniqueEntries}</strong>
        </div>
        <div>
          Dedup ratio: <strong>{ratio != null ? `${ratio}:1` : "—"}</strong>
        </div>
      </div>

      {entry && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          Entry state: {entry.state}. Uncheck consumers one at a time — the entry stays alive as long as ANY
          consumer is mounted, and the in-flight load is only ever aborted once the last one unmounts.
        </p>
      )}
      {mountCount === 0 && (
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>
          No consumers mounted — nothing registered, nothing to dedupe yet.
        </p>
      )}
    </Card>
  );
}
