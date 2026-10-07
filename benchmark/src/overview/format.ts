import type { Priority } from "react-fastload";

export const PRIORITY_ORDER: Priority[] = ["CRITICAL", "HIGH", "NORMAL", "LOW", "IDLE"];

/** CSS custom properties defined in overview.css (same hues as lab/Timeline.tsx). */
export const PRIORITY_COLOR: Record<Priority, string> = {
  CRITICAL: "var(--p-critical)",
  HIGH: "var(--p-high)",
  NORMAL: "var(--p-normal)",
  LOW: "var(--p-low)",
  IDLE: "var(--p-idle)",
};
/** Text-safe variants (the IDLE bar gray is too dim to use as text on dark). */
export const PRIORITY_TEXT: Record<Priority, string> = {
  CRITICAL: "var(--p-critical)",
  HIGH: "var(--p-high)",
  NORMAL: "var(--p-normal)",
  LOW: "var(--p-low)",
  IDLE: "var(--p-idle-text)",
};

/**
 * Display formatting only — the underlying values are never altered.
 * < 10 ms keeps one decimal so sub-millisecond-ish values are not rounded
 * to a misleading "0"; ≥ 1000 ms switches to seconds with two decimals.
 */
export function formatMs(ms: number | null): { value: string; unit: string } {
  if (ms === null || !Number.isFinite(ms)) return { value: "—", unit: "" };
  if (ms >= 1000) return { value: (ms / 1000).toFixed(2), unit: "s" };
  if (ms < 10) return { value: ms.toFixed(1), unit: "ms" };
  return { value: String(Math.round(ms)), unit: "ms" };
}

export function formatMsText(ms: number | null): string {
  const f = formatMs(ms);
  return f.unit ? `${f.value} ${f.unit}` : f.value;
}

/** Raw-table precision: always one decimal, always ms. */
export function formatRawMs(ms: number | null): string {
  return ms === null || !Number.isFinite(ms) ? "—" : `${ms.toFixed(1)} ms`;
}
