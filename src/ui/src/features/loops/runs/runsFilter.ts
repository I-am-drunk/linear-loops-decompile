/**
 * T-703 — runs list filtering + ordering. Pure; strip-types safe.
 * Newest first (createdAt desc). Filters: all / active (live statuses) /
 * failed (error only — canceled is not a failure, it was asked for).
 */
import type { RunSummary } from "./types.ts";
import { isLiveStatus } from "./format.ts";

export type RunsFilter = "all" | "active" | "failed";

export const RUNS_FILTERS: readonly RunsFilter[] = ["all", "active", "failed"];

export function filterRuns(runs: readonly RunSummary[], filter: RunsFilter): RunSummary[] {
  const sorted = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  switch (filter) {
    case "all":
      return sorted;
    case "active":
      return sorted.filter((r) => isLiveStatus(r.status));
    case "failed":
      return sorted.filter((r) => r.status === "error");
  }
}
