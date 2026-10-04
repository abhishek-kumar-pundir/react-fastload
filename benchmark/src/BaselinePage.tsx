import React, { Suspense, useEffect, useMemo, useState } from "react";
import { SCENARIOS, buildGallery, buildVideos, heroImage } from "./data";
import { WIDGET_IMPORTS } from "./widgets";
import { Dashboard } from "./Dashboard";
import { readAllResourceEntries, entriesBeforeLoad, summarizeEntries, readVitals } from "./metrics";
import { BaselineResourceInventory, readBaselineResourceInventory, type BaselineResourceRow } from "./ResourceInventory";
import { AutoRunner } from "./AutoRunner";
import { getScenario, getRunInfo } from "./url";

/**
 * The control group: plain <img>, plain <video>, plain React.lazy, with
 * only native `loading="lazy"` for below-the-fold images. No ReactFastLoad
 * code runs on this page at all — it exists to give a real, measured
 * baseline to compare against. Content is driven by the selected scenario
 * (?scenario=light|heavy|extreme).
 *
 * Every <img> gets explicit width/height (reserving its box before the
 * image loads), and every <video> gets a CSS aspect-ratio matching its
 * poster — this is what actually prevents CLS; omitting it was a real bug
 * caught during benchmarking, not something fixed by changing what's
 * measured.
 */
export default function BaselinePage() {
  const scenario = SCENARIOS[getScenario()];
  const { auto } = getRunInfo();

  const gallery = useMemo(() => buildGallery(scenario.imageCount), [scenario.imageCount]);
  const videos = useMemo(() => buildVideos(scenario.videoCount), [scenario.videoCount]);
  const widgets = useMemo(
    () =>
      Array.from({ length: scenario.widgetCount }, (_, i) => React.lazy(WIDGET_IMPORTS[i % WIDGET_IMPORTS.length]!)),
    [scenario.widgetCount]
  );

  const [, setTick] = useState(0);
  const [inventory, setInventory] = useState<BaselineResourceRow[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setInventory(readBaselineResourceInventory());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const vitals = readVitals();
  const allEntries = readAllResourceEntries();
  const initial = summarizeEntries(entriesBeforeLoad(allEntries));
  const eventual = summarizeEntries(allEntries);

  return (
    <div>
      <Dashboard title={`Baseline — ${scenario.label}`} vitals={vitals} initial={initial} eventual={eventual} />
      {auto && <AutoRunner mode="baseline" />}

      <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
        <img
          src={heroImage.src}
          alt={heroImage.alt}
          width={heroImage.width}
          height={heroImage.height}
          style={{ width: "100%", height: "auto", aspectRatio: `${heroImage.width}/${heroImage.height}` }}
        />

        <h2>Gallery ({gallery.length} images, native lazy loading)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {gallery.map((img) => (
            <img
              key={img.id}
              src={img.src}
              alt={img.alt}
              width={img.width}
              height={img.height}
              loading="lazy"
              decoding="async"
              style={{ width: "100%", height: 140, objectFit: "cover", borderRadius: 6 }}
            />
          ))}
        </div>

        {videos.length > 0 && (
          <>
            <h2>Video ({videos.length})</h2>
            {videos.map((v) => (
              <video
                key={v.id}
                src={v.src}
                poster={v.poster}
                controls
                preload="metadata"
                style={{ width: "100%", aspectRatio: "16/9", marginBottom: 12 }}
              />
            ))}
          </>
        )}

        <h2>Below-the-fold widgets ({widgets.length}, React.lazy — triggered on first render)</h2>
        <Suspense fallback={<div>Loading widgets…</div>}>
          {widgets.map((Widget, i) => (
            <Widget key={i} />
          ))}
        </Suspense>

        <BaselineResourceInventory rows={inventory} />
      </div>
    </div>
  );
}
