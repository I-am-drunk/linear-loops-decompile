/**
 * Run status → visual tone for the last-run chip. Pure; strip-types safe.
 * Tones map onto theme.css tokens in styles.tsx — no second palette.
 */
import type { RunStatus } from "../../../../model/index.ts";

export type StatusTone = "success" | "danger" | "warning" | "accent" | "muted";

export function statusTone(status: RunStatus): StatusTone {
  switch (status) {
    case "complete":
      return "success";
    case "error":
      return "danger";
    case "awaitingInput":
      return "warning";
    case "active":
    case "pending":
    case "waiting":
      return "accent";
    case "canceled":
      return "muted";
  }
}

/** Never-run loops get a muted "Never run" chip. */
export const NEVER_RUN_TONE: StatusTone = "muted";
