import { useEffect } from "react";
import { useFastLoadContext } from "../components/FastLoadProvider";
import type { Priority } from "../core/types";

/**
 * Lets a component update a registered resource's priority after the
 * fact — e.g. bumping an image from LOW to HIGH once the user hovers
 * over a card, or once a carousel slide becomes the active one.
 */
export function usePriority(resourceId: string, priority: Priority): void {
  const { loadManager } = useFastLoadContext();

  useEffect(() => {
    if (!loadManager.registry.has(resourceId)) return;
    loadManager.setPriority(resourceId, priority);
  }, [loadManager, resourceId, priority]);
}
