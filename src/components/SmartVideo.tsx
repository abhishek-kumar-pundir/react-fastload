import React, { useMemo, useState } from "react";
import { useLazyLoad } from "../hooks/useLazyLoad";
import { loadVideo } from "../resources/VideoLoader";
import type { LoadingStrategy, Priority, ResourceRecord } from "../core/types";
import type { PriorityProp } from "./SmartImage";

export interface SmartVideoProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "src" | "poster" | "preload"> {
  src: string;
  poster?: string;
  priority?: PriorityProp;
  resourceId?: string;
  strategy?: LoadingStrategy;
  /** Estimated byte size (the full video, not just the poster), used only for the bytesDeferred metric — never affects loading behavior. */
  estimatedSize?: number;
  /**
   * CSS `aspect-ratio` (e.g. `"16/9"`) reserved for BOTH the pre-eligible
   * placeholder and the real `<video>` element, so swapping between them
   * doesn't change the element's box size — that mismatch is a real
   * layout-shift (CLS) source if left to each render its own default
   * height. Omit only if you're already reserving space yourself via a
   * wrapping container.
   */
  aspectRatio?: string;
  /**
   * Explicit autoplay request. Unlike the native `autoPlay` attribute,
   * this is only honored once the resource has actually become eligible
   * (in view / eager), so a below-the-fold "autoplay" video never
   * silently starts downloading and playing off-screen.
   */
  autoplay?: boolean;
}

function resolvePriority(priority: PriorityProp | undefined): Priority {
  if (!priority || priority === "auto") return "NORMAL";
  return priority;
}

/**
 * A <video> wrapper that avoids downloading video data before it's
 * needed. Below the preload zone, it renders only the poster (if given)
 * with `preload="none"`; once eligible, it mounts a real <video> with
 * `preload="metadata"` (or "auto" for CRITICAL/HIGH priority) and, if
 * `autoplay` was requested, attempts to play once mounted.
 *
 * We never fetch the video bytes ourselves — the browser's own
 * range-request/streaming behavior handles that once the element mounts,
 * per the "work with browser-native mechanisms" requirement.
 */
export function SmartVideo({
  src,
  poster,
  priority = "auto",
  resourceId,
  strategy = "auto",
  estimatedSize,
  aspectRatio,
  autoplay = false,
  muted,
  controls = true,
  style,
  ...rest
}: SmartVideoProps) {
  // Defaults to `${type}:${src}` for request deduplication — see
  // SmartImage's id comment, same reasoning applies here.
  const id = resourceId ?? `video:${src}`;
  const resolvedPriority = resolvePriority(priority);
  const effectiveStrategy: LoadingStrategy =
    strategy === "auto" ? (resolvedPriority === "CRITICAL" ? "eager" : "lazy") : strategy;

  const [userInteracted, setUserInteracted] = useState(false);

  const loader = useMemo(
    () => (resource: ResourceRecord) =>
      loadVideo({ src, poster, priority: resolvedPriority, signal: resource.abortController?.signal }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, poster, resolvedPriority]
  );

  const { ref, state } = useLazyLoad({
    id,
    type: "video",
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
  const shouldMountVideo = isEligible || userInteracted;

  if (!shouldMountVideo) {
    return (
      <div
        ref={ref as unknown as React.Ref<HTMLDivElement>}
        role="button"
        tabIndex={0}
        aria-label="Load video"
        data-fastload-state={state}
        onClick={() => setUserInteracted(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setUserInteracted(true);
        }}
        style={{
          position: "relative",
          cursor: "pointer",
          backgroundImage: poster ? `url(${poster})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: aspectRatio ? undefined : 120,
          aspectRatio,
          ...style,
        }}
      >
        <PlayGlyph />
      </div>
    );
  }

  return (
    <video
      ref={ref as unknown as React.Ref<HTMLVideoElement>}
      src={src}
      poster={poster}
      preload={resolvedPriority === "CRITICAL" || resolvedPriority === "HIGH" ? "auto" : "metadata"}
      autoPlay={autoplay && isEligible}
      muted={autoplay ? true : muted}
      controls={controls}
      data-fastload-state={state}
      style={{ aspectRatio, ...style }}
      {...rest}
    />
  );
}

function PlayGlyph() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="23" fill="rgba(0,0,0,0.55)" stroke="white" strokeWidth="1" />
      <polygon points="19,14 19,34 35,24" fill="white" />
    </svg>
  );
}
