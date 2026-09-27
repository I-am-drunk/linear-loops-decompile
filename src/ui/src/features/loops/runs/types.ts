/**
 * T-703 — runs pages view models. Mirrors the runtime contract
 * (SPECS/agent.md §runtime-contract: Run/Turn/Part) as flat, JSON-safe props;
 * the R9 container maps runtime records into these. Pages never fetch.
 */
import type { LoopEventEntity, RunStatus } from "../../../../../model/index.ts";

/** What a run acted on (absent for schedule/chat runs). */
export interface RunTarget {
  readonly entityType: LoopEventEntity;
  /** Short display label, e.g. "ENG-123" or a project name — pre-resolved. */
  readonly label: string;
}

/** One row in the runs list. */
export interface RunSummary {
  readonly id: string;
  readonly loopId: string;
  readonly loopName: string;
  readonly status: RunStatus;
  readonly target?: RunTarget | undefined;
  readonly createdAt: string;
  readonly startedAt?: string | undefined;
  readonly endedAt?: string | undefined;
  /** Wall-clock duration when finished (or so far, when live). */
  readonly durationMs?: number | undefined;
  readonly costUsd?: number | undefined;
}

/**
 * One streamed activity inside a run — mirrors R5's Part union
 * (thought/action/response/elicitation/error/steered), flattened with the
 * turn position so the stream renders ordered without turn bookkeeping.
 */
export type ActivityItem =
  | { readonly kind: "thought"; readonly id: string; readonly position: number; readonly text: string }
  | {
      readonly kind: "action";
      readonly id: string;
      readonly position: number;
      readonly tool: string;
      readonly label: string;
      readonly argsSummary?: string | undefined;
      readonly resultSummary?: string | undefined;
    }
  | { readonly kind: "response"; readonly id: string; readonly position: number; readonly text: string }
  | {
      readonly kind: "elicitation";
      readonly id: string;
      readonly position: number;
      readonly elicitationKind: "freeText" | "auth" | "select";
      readonly prompt: string;
      readonly choices?: readonly string[] | undefined;
    }
  | { readonly kind: "error"; readonly id: string; readonly position: number; readonly message: string }
  | { readonly kind: "steered"; readonly id: string; readonly position: number; readonly text: string };

/** The run detail page's data. */
export interface RunDetail extends RunSummary {
  readonly summary?: string | undefined;
  readonly usage?: { readonly inputTokens: number; readonly outputTokens: number; readonly costUsd: number } | undefined;
  readonly error?: string | undefined;
  /** Ordered stream (by position ascending). */
  readonly activities: readonly ActivityItem[];
}

export interface RunsListPageProps {
  readonly runs: readonly RunSummary[];
  readonly onOpenRun: (loopId: string, runId: string) => void;
}

export interface RunDetailPageProps {
  readonly run: RunDetail;
  /** Cancel a live run (visible while pending/waiting/active/awaitingInput). */
  readonly onCancel: (runId: string) => void;
  /**
   * The follow-up box's one send intent; meaning depends on status:
   * awaitingInput → answer the elicitation; active/pending/waiting → steer
   * the live run; complete/error/canceled → continue as a follow-up run
   * (resume seam, SPECS/loops.md §run-view).
   */
  readonly onSend: (runId: string, text: string) => void;
}
