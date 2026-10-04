import React, { useMemo, useState } from "react";
import { useLazyLoad } from "../hooks/useLazyLoad";
import { loadAudio } from "../resources/AudioLoader";
import type { LoadingStrategy, Priority, ResourceRecord } from "../core/types";
import type { PriorityProp } from "./SmartImage";

export interface SmartAudioProps
  extends Omit<React.AudioHTMLAttributes<HTMLAudioElement>, "src" | "preload"> {
  src: string;
  priority?: PriorityProp;
  resourceId?: string;
  strategy?: LoadingStrategy;
  /** Estimated byte size, used only for the bytesDeferred metric — never affects loading behavior. */
  estimatedSize?: number;
  /** Track title, shown on the pre-eligible placeholder's play affordance. Optional. */
  label?: string;
  /**
   * Same semantics as SmartVideo's `autoplay`: only honored once the
   * resource is actually eligible, and implies `muted` — most browsers
   * block unmuted audio autoplay outright, so this exists mainly for
   * background/ambient-track use cases where that's acceptable.
   */
  autoplay?: boolean;
}

function resolvePriority(priority: PriorityProp | undefined): Priority {
  if (!priority || priority === "auto") return "NORMAL";
  return priority;
}

/**
 * An <audio> wrapper for songs/podcasts/sound effects — the audio
 * equivalent of SmartVideo. Below the preload zone it renders a small
 * click/keyboard-activatable placeholder instead of a real <audio>
 * element, so nothing downloads early. Once eligible, it mounts a real
 * <audio> with `preload="auto"` for CRITICAL/HIGH priority or
 * `preload="metadata"` otherwise, and lets the browser's own streaming
 * behavior handle the actual byte transfer — this library never fetches
 * audio data itself.
 */
export function SmartAudio({
  src,
  priority = "auto",
  resourceId,
  strategy = "auto",
  estimatedSize,
  label,
  autoplay = false,
  muted,
  controls = true,
  ...rest
}: SmartAudioProps) {
  // Defaults to `${type}:${src}` for request deduplication — see
  // SmartImage's id comment, same reasoning applies here.
  const id = resourceId ?? `audio:${src}`;
  const resolvedPriority = resolvePriority(priority);
  const effectiveStrategy: LoadingStrategy =
    strategy === "auto" ? (resolvedPriority === "CRITICAL" ? "eager" : "lazy") : strategy;

  const [userInteracted, setUserInteracted] = useState(false);

  const loader = useMemo(
    () => (resource: ResourceRecord) =>
      loadAudio({ src, priority: resolvedPriority, signal: resource.abortController?.signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, resolvedPriority]
  );

  const { ref, state } = useLazyLoad({
    id,
    type: "audio",
    priority: resolvedPriority,
    strategy: effectiveStrategy,
    estimatedSize,
    // Stored so tooling (e.g. a benchmark or devtools panel) can
    // cross-reference a deferred registry entry against its real
    // Resource Timing entry once it eventually loads. Never read by the
    // scheduler itself.
    meta: { src },
    loader,
  });

  const isEligible = effectiveStrategy === "eager" || state === "loading" || state === "loaded";
  const shouldMountAudio = isEligible || userInteracted;

  if (!shouldMountAudio) {
    return (
      <div
        ref={ref as unknown as React.Ref<HTMLDivElement>}
        role="button"
        tabIndex={0}
        aria-label={label ? `Load audio: ${label}` : "Load audio"}
        data-fastload-state={state}
        onClick={() => setUserInteracted(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setUserInteracted(true);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 999,
          border: "1px solid rgba(0,0,0,0.15)",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <PlayGlyph />
        {label ?? "Load audio"}
      </div>
    );
  }

  return (
    <audio
      ref={ref as unknown as React.Ref<HTMLAudioElement>}
      src={src}
      preload={resolvedPriority === "CRITICAL" || resolvedPriority === "HIGH" ? "auto" : "metadata"}
      autoPlay={autoplay && isEligible}
      muted={autoplay ? true : muted}
      controls={controls}
      data-fastload-state={state}
      {...rest}
    />
  );
}

function PlayGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="6,4 6,20 20,12" fill="currentColor" />
    </svg>
  );
}
