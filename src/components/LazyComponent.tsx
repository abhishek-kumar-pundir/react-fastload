import React, { Suspense, useId, useMemo } from "react";
import { useLazyLoad } from "../hooks/useLazyLoad";
import { createComponentLoader, type DynamicImport } from "../resources/ComponentLoader";
import type { LoadingStrategy, Priority } from "../core/types";

export interface LazyComponentOptions {
  priority?: Priority;
  /** Overrides the provider's preloadDistance for this component only. Currently informational — actual gating uses the provider's shared observer distance; a per-instance override is planned for a future minor version. */
  preloadDistance?: number;
  strategy?: LoadingStrategy;
  /** Rendered while the component hasn't become eligible to load yet. Defaults to null (renders nothing). */
  placeholder?: React.ReactNode;
  /** Rendered by Suspense while the dynamic import is in flight. Defaults to `placeholder`. */
  fallback?: React.ReactNode;
  resourceId?: string;
  /** Estimated byte size of the chunk this component imports, used only for the bytesDeferred metric — never affects loading behavior. */
  estimatedSize?: number;
}

/**
 * Wraps React.lazy + Suspense so that the dynamic import() itself is not
 * triggered until the scheduler decides this component is eligible
 * (in the preload zone, or eager/CRITICAL). Plain React.lazy has no
 * concept of "not yet" — it fetches as soon as it's first rendered. This
 * is the actual gap LazyComponent closes over ordinary code splitting.
 */
export function lazyComponent<P extends object>(
  importFn: DynamicImport<React.ComponentType<P>>,
  options: LazyComponentOptions = {}
): React.ComponentType<P> {
  const cachedImport = createComponentLoader(importFn);
  const priority: Priority = options.priority ?? "NORMAL";
  const strategy: LoadingStrategy = options.strategy ?? (priority === "CRITICAL" ? "eager" : "lazy");

  function LazyComponentWrapper(props: P) {
    const generatedId = useId();
    const id = options.resourceId ?? `component:${generatedId}`;

    const LazyReal = useMemo(() => React.lazy(cachedImport), []);

    const loader = useMemo(
      () => () => cachedImport().then(() => undefined),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      []
    );

    const { ref, state } = useLazyLoad({
      id,
      type: "component",
      priority,
      strategy,
      estimatedSize: options.estimatedSize,
      loader,
    });

    const isEligible = strategy === "eager" || state === "eligible" || state === "loading" || state === "loaded";

    if (!isEligible) {
      return (
        <div ref={ref as unknown as React.Ref<HTMLDivElement>} data-fastload-state={state}>
          {options.placeholder ?? null}
        </div>
      );
    }

    // React.lazy's inferred component type doesn't preserve the generic P
    // through the assignment above in a way TS can verify structurally;
    // the cast is safe because LazyReal is React.lazy(cachedImport), whose
    // resolved module default is exactly React.ComponentType<P>.
    const Rendered = LazyReal as unknown as React.ComponentType<P>;

    return (
      <Suspense fallback={options.fallback ?? options.placeholder ?? null}>
        <Rendered {...props} />
      </Suspense>
    );
  }

  LazyComponentWrapper.displayName = `LazyComponent(${options.resourceId ?? "anonymous"})`;
  return LazyComponentWrapper;
}
