/**
 * Loops feature barrel. T-701 ships the list page; editor (T-702), runs
 * (T-703), and templates (T-704) join this barrel as they land.
 */
export { LoopsListPage } from "./LoopsListPage.tsx";
export { LoopsStyles } from "./styles.tsx";
export { LoopRow } from "./LoopRow.tsx";
export { LoopGlyph } from "./LoopGlyph.tsx";
export { groupLoops, filterLoops, WORKSPACE_GROUP } from "./grouping.ts";
export type { LoopGroup } from "./grouping.ts";
export { triggerLabel, scheduleLabel } from "./triggerLabel.ts";
export { relativeAgo, lastRunLabel } from "./relativeTime.ts";
export { statusTone, NEVER_RUN_TONE } from "./statusTone.ts";
export type { StatusTone } from "./statusTone.ts";
export { demoLoops } from "./fixtures.ts";
export type {
  LastRunInfo,
  LoopSummary,
  LoopsListPageProps,
} from "./types.ts";
