/**
 * Pure derived-metric functions, kept separate from any React/DOM code so
 * they're trivially unit-testable with plain arrays — no mocked timers,
 * no jsdom. Every function here documents its exact formula, per the
 * "every derived metric must have a documented formula" requirement.
 */

export interface RunStats {
  median: number | null;
  min: number | null;
  max: number | null;
  mean: number | null;
  n: number;
}

/** median = sorted middle value (average of the two middle values for an even-length array). */
export function summarizeRuns(values: number[]): RunStats {
  const clean = values.filter((v) => Number.isFinite(v)).slice().sort((a, b) => a - b);
  if (clean.length === 0) return { median: null, min: null, max: null, mean: null, n: 0 };

  const mid = Math.floor(clean.length / 2);
  const median = clean.length % 2 === 0 ? (clean[mid - 1]! + clean[mid]!) / 2 : clean[mid]!;
  const mean = clean.reduce((sum, v) => sum + v, 0) / clean.length;

  return { median, min: clean[0]!, max: clean[clean.length - 1]!, mean, n: clean.length };
}

export interface TimelinePoint {
  eligibleAtMs: number | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
}

/**
 * Span metrics across a set of resources' real timestamps:
 * - firstStartMs: earliest loadStartedAt across all resources.
 * - lastCompletionMs: latest loadEndedAt across all resources.
 * - completionSpanMs = lastCompletionMs - firstStartMs. Null if either
 *   endpoint is missing (e.g. nothing has finished loading yet).
 */
export function computeSpan(points: TimelinePoint[]): {
  firstStartMs: number | null;
  lastCompletionMs: number | null;
  completionSpanMs: number | null;
} {
  const starts = points.map((p) => p.startedAtMs).filter((v): v is number => v != null);
  const completions = points.map((p) => p.completedAtMs).filter((v): v is number => v != null);

  const firstStartMs = starts.length > 0 ? Math.min(...starts) : null;
  const lastCompletionMs = completions.length > 0 ? Math.max(...completions) : null;
  const completionSpanMs =
    firstStartMs != null && lastCompletionMs != null ? lastCompletionMs - firstStartMs : null;

  return { firstStartMs, lastCompletionMs, completionSpanMs };
}

/**
 * Dedup ratio = how many logical "mount" calls resolved to each actual
 * registry entry. E.g. 3 mounted <SmartImage> with the same src sharing
 * ONE registry entry = a ratio of 3 (3 consumers : 1 real load).
 * `mountCount` must come from counting actual mount/register calls made
 * by the caller — this function never infers it.
 */
export function computeDedupRatio(mountCount: number, uniqueRegistryEntries: number): number | null {
  if (uniqueRegistryEntries <= 0) return null;
  return mountCount / uniqueRegistryEntries;
}
