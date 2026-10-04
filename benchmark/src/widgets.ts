export const WIDGET_IMPORTS = [
  () => import("./lazy/HeavyWidgetA"),
  () => import("./lazy/HeavyWidgetB"),
  () => import("./lazy/HeavyWidgetC"),
] as const;

/** Rough estimate of one widget chunk's transferred size — tiny demo components, not real production bundles. */
export const WIDGET_ESTIMATED_SIZE = 1_800;
