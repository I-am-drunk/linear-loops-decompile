/**
 * Runs (AU6, docs/plan/automations.md).
 *
 * A paginated feed per automation: status, when, duration, cost, and the
 * transcript. Run state is OURS entirely — no public API exposes automation
 * runs — so this is the record the runner writes and the UI reads.
 *
 * Pure: a sort-and-paginate kernel plus the section AU2 renders. No runner,
 * no RPC. The runner is a later slice; this is the shape it writes into.
 */

import type { Draft, SectionSpec } from "./detail.ts";
import type { ProviderFailure } from "../inference/types.ts";
import type { Row } from "../ui-settings/rows.ts";

export type RunStatus = `queued` | `running` | `succeeded` | `failed` | `cancelled`;

export type Run = {
  id: string;
  automationId: string;
  status: RunStatus;
  /** ISO-8601. `startedAt` is absent while queued; `endedAt` while running. */
  queuedAt: string;
  startedAt?: string;
  endedAt?: string;
  /** Integral cents, from the provider's cost(); absent until known. */
  costCents?: number;
  /** Why a failed run failed, when a provider was the cause. */
  failure?: ProviderFailure;
  transcript: readonly TranscriptEntry[];
};

/** One line of what happened, in order. Frozen once written. */
export type TranscriptEntry =
  | { kind: `prompt`; step: number; model: string; text: string }
  | { kind: `response`; step: number; text: string; inputTokens: number; outputTokens: number }
  | { kind: `tool`; server: string; tool: string; ok: boolean; detail?: string }
  | { kind: `error`; detail: string };

/** Wall-clock duration in ms, or undefined while still running or queued. */
export function durationMs(run: Run): number | undefined {
  if (!run.startedAt || !run.endedAt) return undefined;
  const ms = Date.parse(run.endedAt) - Date.parse(run.startedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

/**
 * Newest first. `queuedAt` is the one timestamp every run has, so it is the
 * sort key; `id` breaks ties so two runs queued in the same millisecond keep
 * a stable order between renders.
 */
export function sortRuns(runs: readonly Run[]): Run[] {
  return [...runs].sort((a, b) => {
    const t = Date.parse(b.queuedAt) - Date.parse(a.queuedAt);
    return t !== 0 ? t : (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });
}

export type Page = { runs: Run[]; nextCursor?: string };

/**
 * Cursor pagination by run id. A cursor is the id of the last run on the
 * previous page, so a run inserted at the top between requests cannot shift
 * the window and repeat or skip a row the way offset paging would.
 */
export function pageRuns(runs: readonly Run[], size: number, cursor?: string): Page {
  const sorted = sortRuns(runs);
  const start = cursor === undefined ? 0 : sorted.findIndex((r) => r.id === cursor) + 1;
  const slice = sorted.slice(start, start + Math.max(1, size));
  const last = slice[slice.length - 1];
  const more = last !== undefined && start + slice.length < sorted.length;
  return more ? { runs: slice, nextCursor: last.id } : { runs: slice };
}

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: `Queued`, running: `Running`, succeeded: `Succeeded`, failed: `Failed`, cancelled: `Cancelled`,
};

/** `failed` with a provider failure names the provider the automation ASKED for. */
function statusDetail(run: Run): string {
  const parts: string[] = [];
  if (run.status === `failed` && run.failure) {
    parts.push(run.failure.kind === `unavailable`
      ? `provider_unavailable: ${run.failure.provider}`
      : `${run.failure.kind}: ${run.failure.provider}`);
  }
  const ms = durationMs(run);
  if (ms !== undefined) parts.push(ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
  if (run.costCents !== undefined) parts.push(`$${(run.costCents / 100).toFixed(2)}`);
  return parts.join(` · `);
}

/** One connection row per run: the badge is the status, the detail is the facts. */
function runRow(run: Run): Row {
  const state = run.status === `succeeded` ? `connected`
    : run.status === `failed` ? `error`
      : run.status === `running` ? `checking` : `disconnected`;
  const detail = statusDetail(run);
  return { kind: `connection`, id: `run.${run.id}`, label: `${STATUS_LABEL[run.status]} · ${run.queuedAt}`,
    state, ...(detail === `` ? {} : { detail }) };
}

/** The draft key the Runs section reads. The runner writes it; the UI never does. */
export const RUNS_KEY = `runs`;

export function runsOf(draft: Draft): Run[] {
  const v = draft[RUNS_KEY];
  return Array.isArray(v) ? (v as Run[]) : [];
}

/**
 * The section AU2 renders: the newest page of runs. `order: 60` puts it
 * last among the plan's sections. `pageSize` is injected so the host decides
 * density; the kernel decides order.
 */
export const runsSection = (pageSize = 10): SectionSpec => ({
  id: `runs`,
  title: `Runs`,
  blurb: `Newest first. Each run keeps its transcript.`,
  order: 60,
  build: (draft) => {
    const page = pageRuns(runsOf(draft), pageSize);
    if (page.runs.length === 0) {
      return [{ kind: `text`, id: `run.none`, label: `No runs yet`, value: ``,
        description: `Runs appear here once a trigger fires or you press run.`, disabled: true }];
    }
    return page.runs.map(runRow);
  },
});
