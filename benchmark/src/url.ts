import { parseScenario, type ScenarioName } from "./data";

export function getParams() {
  return new URLSearchParams(window.location.search);
}

export function getMode(): "baseline" | "fastload" | "results" {
  const mode = getParams().get("mode");
  if (mode === "fastload" || mode === "results") return mode;
  return "baseline";
}

export function getScenario(): ScenarioName {
  return parseScenario(getParams().get("scenario"));
}

export function getRunInfo() {
  const params = getParams();
  return {
    auto: params.get("auto") === "1",
    run: Number(params.get("run") ?? "1") || 1,
    totalRuns: Number(params.get("totalRuns") ?? "1") || 1,
  };
}

export function buildUrl(parts: Record<string, string | number | boolean>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parts)) {
    if (value === false || value === undefined) continue;
    params.set(key, value === true ? "1" : String(value));
  }
  return `?${params.toString()}`;
}
