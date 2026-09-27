/**
 * T-701 — view models for the loops list page.
 *
 * Pages are presentational (house rule, src/pages/registry.tsx): they never
 * fetch. A container speaking T3 connect (R9) maps server records
 * (WorkflowDefinition + LoopExecution, src/model) into these props; until
 * then the registry wires fixtures.
 *
 * The list row is a *summary* — resolved display names (ownerName/teamName)
 * arrive pre-joined so the row never issues lookups.
 */
import type { LoopTrigger, RunStatus } from "../../../../model/index.ts";

/** The most recent finished (or running) execution of a loop, for the chip. */
export interface LastRunInfo {
  readonly status: RunStatus;
  /** ISO-8601; for finished runs this is endedAt, for live ones startedAt. */
  readonly at: string;
  readonly durationMs?: number | undefined;
}

/** One row in the loops list. `id` is the slugId used in /loop/:id routes. */
export interface LoopSummary {
  readonly id: string;
  readonly name: string;
  /** Optional emoji or short glyph shown in the icon tile. */
  readonly icon?: string | undefined;
  /** `#rrggbb` tint for the icon tile. */
  readonly color?: string | undefined;
  readonly description?: string | undefined;
  /** Sidebar grouping label (Linear's groupName); beats team when present. */
  readonly groupName?: string | undefined;
  readonly teamName?: string | undefined;
  readonly ownerName: string;
  readonly enabled: boolean;
  readonly trigger: LoopTrigger;
  readonly lastRun?: LastRunInfo | undefined;
}

export interface LoopsListPageProps {
  readonly loops: readonly LoopSummary[];
  /**
   * False when no inference harness is configured (R6). The list then shows
   * the connect-inference empty state instead of the loops — our analog of
   * Linear's "Loops require Linear Agent to be enabled" plan gate
   * (SPECS/loops.md §ui-inventory).
   */
  readonly inferenceConfigured: boolean;
  /** Toggle intent. Server-authoritative: the row keeps showing props until
   *  the container confirms with new props; nothing flips locally. */
  readonly onToggle: (id: string, enabled: boolean) => void;
  /** Row activation → loop detail. */
  readonly onOpen: (id: string) => void;
  /** "New loop" → template library / blank draft flow. */
  readonly onNewLoop: () => void;
  /** Empty-state CTA → settings/inference. */
  readonly onOpenInferenceSettings: () => void;
}
