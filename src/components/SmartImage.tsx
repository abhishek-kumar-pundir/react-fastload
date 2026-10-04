import React, { useMemo } from "react";
import { useLazyLoad } from "../hooks/useLazyLoad";
import { loadImage } from "../resources/ImageLoader";
import { supportsFetchPriority } from "../utils/browserSupport";
import type { LoadingStrategy, Priority, ResourceRecord } from "../core/types";

export type PriorityProp = Priority | "auto";

export interface SmartImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "placeholder" | "onLoad" | "onError"> {
  src: string;
  /** "auto" (default) resolves to NORMAL; pass an explicit Priority to override the scheduler's ranking. */
  priority?: PriorityProp;
  /** Shown while `src` is loading/deferred. Rendered as a background-image so layout doesn't depend on it loading. */
  placeholder?: string;
  /** Explicit id for scheduler bookkeeping/debugging. Defaults to `src`. */
  resourceId?: string;
  /** "eager" skips viewport gating entirely (use for above-the-fold images). "lazy" (default) waits for the preload zone. "auto" behaves like "lazy" but lets CRITICAL priority still force eager. */
  strategy?: LoadingStrategy;
  /** Estimated byte size, used only for the bytesDeferred metric — never affects loading behavior. */
  estimatedSize?: number;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

function resolvePriority(priority: PriorityProp | undefined): Priority {
  if (!priority || priority === "auto") return "NORMAL";
  return priority;
}

/**
 * A drop-in <img> replacement that registers with the ReactFastLoad
 * scheduler instead of relying solely on the browser's native
 * `loading="lazy"`. This adds real value over native lazy loading in two
 * ways: (1) a configurable preload distance shared across every resource
 * type via one scheduler, and (2) priority-aware concurrency — so, e.g.,
 * five LOW-priority images entering view at once don't compete with a
 * HIGH-priority one for the same network queue.
 *
 * For CRITICAL/HIGH priority images with strategy="eager", this renders a
 * plain <img> immediately — it deliberately does NOT duplicate
 * `loading="lazy"` for resources that shouldn't be lazy at all.
 */
export function SmartImage({
  src,
  priority = "auto",
  placeholder,
  resourceId,
  strategy = "auto",
  estimatedSize,
  alt,
  decoding = "async",
  style,
  onLoad,
  onError,
  ...rest
}: SmartImageProps) {
  // Defaults to `${type}:${src}` (not suffixed with a per-instance id) so
  // that two mounted <SmartImage> using the same src resolve to the SAME
  // registry entry — this is what makes request deduplication work (see
  // LoadManager's reference counting). Pass an explicit `resourceId` to
  // opt out when two elements with the same src genuinely need
  // independent scheduling (e.g. deliberately repeating a demo widget).
  const id = resourceId ?? `image:${src}`;
  const resolvedPriority = resolvePriority(priority);
  const effectiveStrategy: LoadingStrategy =
    strategy === "auto" ? (resolvedPriority === "CRITICAL" ? "eager" : "lazy") : strategy;

  const loader = useMemo(
    () => (resource: ResourceRecord) =>
      loadImage({ src, priority: resolvedPriority, decoding, signal: resource.abortController?.signal }).then(
        () => undefined
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [src, resolvedPriority, decoding]
  );

  const { ref, state } = useLazyLoad({
    id,
    type: "image",
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

  const shouldRenderRealImage = effectiveStrategy === "eager" || state === "loading" || state === "loaded";

  const containerStyle: React.CSSProperties = {
    ...style,
    ...(placeholder && !shouldRenderRealImage
      ? {
          backgroundImage: `url(${placeholder})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
  };

  if (!shouldRenderRealImage) {
    return (
      <div
        ref={ref as unknown as React.Ref<HTMLDivElement>}
        role="img"
        aria-label={alt}
        aria-busy={state === "eligible"}
        data-fastload-state={state}
        style={{ display: "inline-block", ...containerStyle }}
      />
    );
  }

  // `fetchPriority` isn't declared on ImgHTMLAttributes in every @types/react
  // version, but it's a real, standardized DOM attribute — pass it through
  // via a loosened type rather than skipping a legitimate perf hint.
  const imgProps: React.ImgHTMLAttributes<HTMLImageElement> & { fetchpriority?: string } = {
    src,
    alt,
    decoding,
    loading: effectiveStrategy === "eager" ? "eager" : "lazy",
    style: containerStyle,
    onLoad,
    onError,
    ...(supportsFetchPriority() ? { fetchpriority: fetchPriorityFor(resolvedPriority) } : {}),
    ...rest,
  };

  return (
    <img
      ref={ref as unknown as React.Ref<HTMLImageElement>}
      data-fastload-state={state}
      {...imgProps}
    />
  );
}

function fetchPriorityFor(priority: Priority): "high" | "low" | "auto" {
  if (priority === "CRITICAL" || priority === "HIGH") return "high";
  if (priority === "LOW" || priority === "IDLE") return "low";
  return "auto";
}
