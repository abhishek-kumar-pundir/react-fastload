import React, { useEffect, useMemo, useState } from "react";
import {
  FastLoadProvider,
  SmartImage,
  SmartVideo,
  lazyComponent,
  useFastLoadMetrics,
  useFastLoadContext,
} from "react-fastload";
import { SCENARIOS, buildGallery, buildVideos, heroImage } from "./data";
import { WIDGET_IMPORTS, WIDGET_ESTIMATED_SIZE } from "./widgets";
import { Dashboard } from "./Dashboard";
import {
  readAllResourceEntries,
  entriesBeforeLoad,
  summarizeEntries,
  readVitals,
  computeActuallyDeferredBytes,
} from "./metrics";
import { FastLoadResourceInventory } from "./ResourceInventory";
import { AutoRunner } from "./AutoRunner";
import { getScenario, getRunInfo } from "./url";

function LiveDashboard({ scenarioLabel }: { scenarioLabel: string }) {
  const { loadManager } = useFastLoadContext();
  const metrics = useFastLoadMetrics();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(interval);
  }, []);

  const vitals = readVitals();
  const allEntries = readAllResourceEntries();
  const initial = summarizeEntries(entriesBeforeLoad(allEntries));
  const eventual = summarizeEntries(allEntries);

  const deferredSrcs = loadManager.registry
    .all()
    .filter((r) => r.deferred)
    .map((r) => r.meta?.src as string | undefined)
    .filter((s): s is string => !!s);
  const actuallyDeferred = computeActuallyDeferredBytes(deferredSrcs, allEntries);

  return (
    <Dashboard
      title={`ReactFastLoad — ${scenarioLabel} (tick ${tick})`}
      vitals={vitals}
      initial={{ requests: initial.requests, transferredBytes: initial.transferredBytes }}
      eventual={eventual}
      scheduler={{
        deferredRequests: metrics.deferredRequests,
        estimatedDeferredBytes: metrics.bytesDeferred,
        actuallyDeferredBytes: actuallyDeferred,
      }}
    />
  );
}

function FastLoadAutoRunnerBridge() {
  const { loadManager } = useFastLoadContext();
  const { auto } = getRunInfo();
  if (!auto) return null;
  return (
    <AutoRunner
      mode="fastload"
      getSchedulerState={() => {
        const summary = loadManager.registry.summary();
        const deferredSrcs = loadManager.registry
          .all()
          .filter((r) => r.deferred)
          .map((r) => r.meta?.src as string | undefined)
          .filter((s): s is string => !!s);
        return {
          deferredRequests: summary.deferredRequests,
          estimatedDeferredBytes: summary.bytesDeferred,
          deferredSrcs,
        };
      }}
    />
  );
}

function FastLoadResourceInventorySection() {
  const { loadManager } = useFastLoadContext();
  const [resources, setResources] = React.useState(() => loadManager.registry.all());
  React.useEffect(() => loadManager.registry.subscribe(setResources), [loadManager]);
  return <FastLoadResourceInventory resources={resources} />;
}

/**
 * The treatment group: content driven by the selected scenario
 * (?scenario=light|heavy|extreme), wrapped in ReactFastLoad's components.
 * Everything below the preload zone is deferred by the shared scheduler
 * instead of only by native `loading="lazy"` / an unconditional
 * React.lazy import.
 *
 * Every <SmartImage> gets explicit width/height, and every <SmartVideo>
 * gets aspectRatio="16/9" — both reserve layout space before the resource
 * loads, which is what actually prevents CLS (a real bug caught during
 * benchmarking: the video placeholder and the mounted <video> previously
 * had different default heights).
 */
export default function FastLoadPage() {
  const scenario = SCENARIOS[getScenario()];

  const gallery = useMemo(() => buildGallery(scenario.imageCount), [scenario.imageCount]);
  const videos = useMemo(() => buildVideos(scenario.videoCount), [scenario.videoCount]);
  const widgets = useMemo(
    () =>
      Array.from({ length: scenario.widgetCount }, (_, i) =>
        lazyComponent(WIDGET_IMPORTS[i % WIDGET_IMPORTS.length]!, {
          resourceId: `widget-${i}`,
          priority: i < 2 ? "LOW" : "IDLE",
          estimatedSize: WIDGET_ESTIMATED_SIZE,
        })
      ),
    [scenario.widgetCount]
  );

  return (
    <FastLoadProvider strategy="adaptive" preloadDistance={800}>
      <LiveDashboard scenarioLabel={scenario.label} />
      <FastLoadAutoRunnerBridge />

      <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
        <SmartImage
          src={heroImage.src}
          alt={heroImage.alt}
          priority="CRITICAL"
          estimatedSize={heroImage.estimatedSize}
          width={heroImage.width}
          height={heroImage.height}
          style={{ width: "100%", height: "auto", aspectRatio: `${heroImage.width}/${heroImage.height}` }}
        />

        <h2>Gallery ({gallery.length} images, scheduled by ReactFastLoad)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {gallery.map((img) => (
            <SmartImage
              key={img.id}
              src={img.src}
              alt={img.alt}
              priority="auto"
              estimatedSize={img.estimatedSize}
              width={img.width}
              height={img.height}
              style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6 }}
            />
          ))}
        </div>

        {videos.length > 0 && (
          <>
            <h2>Video ({videos.length})</h2>
            {videos.map((v) => (
              <SmartVideo
                key={v.id}
                src={v.src}
                poster={v.poster}
                priority="LOW"
                estimatedSize={v.estimatedSize}
                aspectRatio="16/9"
                style={{ width: "100%", marginBottom: 12 }}
              />
            ))}
          </>
        )}

        <h2>Below-the-fold widgets ({widgets.length}, deferred until near view)</h2>
        {widgets.map((Widget, i) => (
          <Widget key={i} />
        ))}

        <FastLoadResourceInventorySection />
      </div>
    </FastLoadProvider>
  );
}
