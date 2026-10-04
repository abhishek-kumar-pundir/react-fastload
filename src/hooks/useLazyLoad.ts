import { useEffect, useRef, useState } from "react";
import { useFastLoadContext } from "../components/FastLoadProvider";
import type { LoaderFn } from "../core/Scheduler";
import type {
  LoadingStrategy,
  Priority,
  ResourceRecord,
  ResourceState,
  ResourceType,
} from "../core/types";

export interface UseLazyLoadOptions {
  id: string;
  type: ResourceType;
  priority: Priority;
  strategy: LoadingStrategy;
  estimatedSize?: number;
  meta?: Record<string, unknown>;
  /** The actual load function (e.g. loadImage, loadVideo, dynamic import wrapper). */
  loader: LoaderFn;
}

export interface UseLazyLoadResult {
  /** Attach to the DOM node whose viewport position should be observed. */
  ref: (node: Element | null) => void;
  state: ResourceState;
  record: ResourceRecord | undefined;
}

/**
 * Shared internal hook: registers a resource with the LoadManager, wires
 * viewport observation up to the provider's single shared
 * ViewportObserver (unless the strategy is "eager", which skips
 * observation entirely and loads immediately), and tracks the resource's
 * state for re-rendering. SmartImage, SmartVideo, and SmartAudio are thin
 * wrappers around this hook plus their own rendering concerns.
 *
 * Request deduplication: `id` defaults to `${type}:${src}` in the Smart*
 * components, so two mounted instances with the same `src` resolve to the
 * SAME resource id here — LoadManager.register()/unregister() are
 * reference-counted specifically so that works correctly (the resource
 * isn't torn down until the LAST consumer unmounts). Pass an explicit
 * `resourceId` to opt out when two elements with the same src genuinely
 * need independent scheduling.
 */
export function useLazyLoad(options: UseLazyLoadOptions): UseLazyLoadResult {
  const { loadManager } = useFastLoadContext();
  const { id, type, priority, strategy, estimatedSize, meta, loader } = options;

  const unobserveRef = useRef<(() => void) | undefined>(undefined);
  const elementRef = useRef<Element | null>(null);
  const shouldObserveRef = useRef(strategy !== "eager" && priority !== "CRITICAL");
  shouldObserveRef.current = strategy !== "eager" && priority !== "CRITICAL";

  const [state, setState] = useState<ResourceState>("idle");
  const [record, setRecord] = useState<ResourceRecord | undefined>(undefined);

  useEffect(() => {
    const initial = loadManager.register({ id, type, priority, strategy, estimatedSize, meta });
    setRecord(initial);
    setState(initial.state);
    loadManager.setLoader(id, loader);

    const unsubscribe = loadManager.registry.subscribe((all) => {
      const found = all.find((r) => r.id === id);
      if (found) {
        setRecord(found);
        setState(found.state);
      }
    });

    if (shouldObserveRef.current && elementRef.current) {
      unobserveRef.current = loadManager.observeViewport(id, elementRef.current);
    }

    return () => {
      unsubscribe();
      unobserveRef.current?.();
      unobserveRef.current = undefined;
      loadManager.unregister(id);
    };
    // Intentionally re-run only when the resource identity changes —
    // priority/estimatedSize changes are handled by usePriority instead
    // of re-registering the whole resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const ref = (node: Element | null) => {
    if (elementRef.current === node) return;

    unobserveRef.current?.();
    unobserveRef.current = undefined;
    elementRef.current = node;

    if (node && shouldObserveRef.current) {
      unobserveRef.current = loadManager.observeViewport(id, node);
    }
  };

  return { ref, state, record };
}
