/**
 * T-1104 — wire → view-model folds. Pure, strip-types safe, no React, no
 * DOM: the containers' entire brain lives here so it is unit-testable under
 * plain `node --test`.
 *
 * Input shapes: wire.ts DTOs (runtime Run/Turn records). Output shapes: the
 * presentational pages' props (T-701 loops list, T-703 runs pages) — pages
 * stay untouched; the container boundary absorbs every compromise.
 *
 * Stream events (runs.event payloads) are the runtime's RunEvent payloads,
 * carried by the channel as opaque `{type, …}` records: the channel assigns
 * its own wire `seq`, so the payload's fields are validated at the boundary
 * (narrowStreamEvent) rather than trusted.
 */
import type { RunStatus } from "../../../model/enums.ts";
import type { PendingElicitation, TurnStatus } from "../../../model/conversation.ts";
import type { Part, Run, RunUsage, Turn } from "../../../runtime/types.ts";
import type { LoopDto } from "./wire.ts";
import type { LastRunInfo, LoopSummary } from "../features/loops/types.ts";
import type { ActivityItem, RunDetail, RunSummary } from "../features/loops/runs/types.ts";

/** The runtime's run-stream payload as the UI consumes it (seq stripped). */
export type RunStreamEvent =
  | { readonly type: "runStatus"; readonly status: RunStatus; readonly run: Run }
  | { readonly type: "turnStarted"; readonly turn: Turn }
  | { readonly type: "partAppended"; readonly turnId: string; readonly part: Part }
  | { readonly type: "turnCompleted"; readonly turnId: string; readonly status: TurnStatus }
  | { readonly type: "usage"; readonly usage: RunUsage };

/**
 * Validate an opaque runs.event payload. Returns null for shapes the UI
 * cannot fold — never throws: a malformed event must not kill the stream.
 */
export function narrowStreamEvent(raw: Record<string, unknown> & { type: string }): RunStreamEvent | null {
  switch (raw["type"]) {
    case "runStatus": {
      const run = raw["run"] as Run | undefined;
      const status = raw["status"] as RunStatus | undefined;
      return run !== undefined && typeof run.id === "string" && status !== undefined
        ? { type: "runStatus", status, run }
        : null;
    }
    case "turnStarted": {
      const turn = raw["turn"] as Turn | undefined;
      return turn !== undefined && typeof turn.id === "string" ? { type: "turnStarted", turn } : null;
    }
    case "partAppended": {
      const turnId = raw["turnId"];
      const part = raw["part"] as Part | undefined;
      return typeof turnId === "string" && part !== undefined && typeof part.kind === "string"
        ? { type: "partAppended", turnId, part }
        : null;
    }
    case "turnCompleted": {
      const turnId = raw["turnId"];
      const status = raw["status"] as TurnStatus | undefined;
      return typeof turnId === "string" && status !== undefined ? { type: "turnCompleted", turnId, status } : null;
    }
    case "usage": {
      const usage = raw["usage"] as RunUsage | undefined;
      return usage !== undefined && typeof usage.costUsd === "number" ? { type: "usage", usage } : null;
    }
    default:
      return null;
  }
}

// ---- loops ---------------------------------------------------------------

/** Self-hosted, single-user default when the server pre-resolves no names. */
export const DEFAULT_OWNER_NAME = "You";

export function loopSummaryOf(dto: LoopDto, lastRun?: LastRunInfo): LoopSummary {
  return {
    id: dto.id,
    name: dto.name,
    icon: dto.config.icon,
    color: dto.config.color,
    description: dto.config.description,
    groupName: dto.config.groupName,
    teamName: dto.teamName,
    ownerName: dto.ownerName ?? DEFAULT_OWNER_NAME,
    enabled: dto.enabled,
    trigger: dto.config.trigger,
    lastRun,
  };
}

export function lastRunInfoOf(run: Run, now: Date): LastRunInfo {
  return {
    status: run.status,
    at: run.endedAt ?? run.startedAt ?? run.createdAt,
    durationMs: durationMsOf(run, now),
  };
}

/** The latest run per loop id (input order need not be sorted). */
export function latestRunByLoop(runs: readonly Run[]): Map<string, Run> {
  const latest = new Map<string, Run>();
  for (const run of runs) {
    const prev = latest.get(run.loopId);
    if (prev === undefined || run.createdAt > prev.createdAt) latest.set(run.loopId, run);
  }
  return latest;
}

/** Full loops-list view: loops joined with their last-run chips. */
export function loopsViewOf(loops: readonly LoopDto[], runs: readonly Run[], now: Date): LoopSummary[] {
  const latest = latestRunByLoop(runs);
  return loops.map((dto) => {
    const last = latest.get(dto.id);
    return loopSummaryOf(dto, last !== undefined ? lastRunInfoOf(last, now) : undefined);
  });
}

// ---- runs ----------------------------------------------------------------

/** Wall-clock duration: finished runs measure start→end, live runs start→now. */
export function durationMsOf(run: Run, now: Date): number | undefined {
  if (run.startedAt === undefined) return undefined;
  const start = Date.parse(run.startedAt);
  const end = run.endedAt !== undefined ? Date.parse(run.endedAt) : now.getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return undefined;
  return end - start;
}

export function runSummaryOf(run: Run, loopName: string | undefined, now: Date): RunSummary {
  return {
    id: run.id,
    loopId: run.loopId,
    loopName: loopName ?? run.loopId,
    status: run.status,
    target: run.target !== undefined
      ? { entityType: run.target.entity, label: run.target.label ?? run.target.id }
      : undefined,
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    durationMs: durationMsOf(run, now),
    costUsd: run.usage.costUsd > 0 ? run.usage.costUsd : undefined,
  };
}

/** Flatten one part into the stream's view item (id synthesized, order-stable). */
function activityOfPart(id: string, position: number, part: Part): ActivityItem {
  switch (part.kind) {
    case "thought":
      return { kind: "thought", id, position, text: part.text };
    case "action":
      return {
        kind: "action",
        id,
        position,
        tool: part.tool,
        label: part.label,
        argsSummary: part.argsSummary,
        resultSummary: part.resultSummary,
      };
    case "response":
      return { kind: "response", id, position, text: part.text };
    case "elicitation":
      return {
        kind: "elicitation",
        id,
        position,
        elicitationKind: part.elicitationKind,
        prompt: part.prompt,
        choices: part.choices,
      };
    case "error":
      return { kind: "error", id, position, message: part.message };
    case "steered":
      return { kind: "steered", id, position, text: part.text };
  }
}

/**
 * The parked elicitation renders exactly once. The runtime both streams the
 * elicitation as a part AND mirrors it on the run record — append it only
 * when no elicitation with the same prompt is already in the stream.
 */
function withPendingElicitation(
  activities: readonly ActivityItem[],
  pending: PendingElicitation | undefined,
): readonly ActivityItem[] {
  if (pending === undefined) return activities;
  const already = activities.some((a) => a.kind === "elicitation" && a.prompt === pending.prompt);
  if (already) return activities;
  const position = activities.reduce((max, a) => Math.max(max, a.position), 0) + 1;
  return [
    ...activities,
    {
      kind: "elicitation",
      id: "pending-elicitation",
      position,
      elicitationKind: pending.elicitationKind,
      prompt: pending.prompt,
      choices: pending.choices,
    },
  ];
}

/** runs.get fold: run + turn history → the detail page's data. */
export function runDetailOf(run: Run, turns: readonly Turn[], loopName: string | undefined, now: Date): RunDetail {
  const ordered = [...turns].sort((a, b) => a.position - b.position);
  const activities: ActivityItem[] = [];
  let position = 0;
  for (const turn of ordered) {
    turn.parts.forEach((part, index) => {
      position += 1;
      activities.push(activityOfPart(`t${turn.position}p${index}`, position, part));
    });
  }
  const base: RunDetail = {
    ...runSummaryOf(run, loopName, now),
    summary: run.summary,
    usage: run.usage.costUsd > 0 || run.usage.inputTokens > 0 ? run.usage : undefined,
    error: run.error,
    activities: [],
  };
  const withParts = { ...base, activities };
  return {
    ...withParts,
    activities:
      run.status === "awaitingInput"
        ? withPendingElicitation(activities, run.pendingElicitation)
        : activities,
  };
}

/** Fold one stream event into the detail view (runs.subscribe live tail). */
export function applyRunEventToDetail(detail: RunDetail, event: RunStreamEvent): RunDetail {
  switch (event.type) {
    case "runStatus": {
      const run = event.run;
      const next: RunDetail = {
        ...detail,
        status: run.status,
        startedAt: run.startedAt ?? detail.startedAt,
        endedAt: run.endedAt,
        summary: run.summary ?? detail.summary,
        error: run.error,
        usage: run.usage.costUsd > 0 || run.usage.inputTokens > 0 ? run.usage : detail.usage,
        costUsd: run.usage.costUsd > 0 ? run.usage.costUsd : detail.costUsd,
      };
      return run.status === "awaitingInput"
        ? { ...next, activities: withPendingElicitation(next.activities, run.pendingElicitation) }
        : next;
    }
    case "partAppended": {
      const position = detail.activities.reduce((max, a) => Math.max(max, a.position), 0) + 1;
      return {
        ...detail,
        activities: [...detail.activities, activityOfPart(`live-${position}`, position, event.part)],
      };
    }
    case "usage":
      return { ...detail, usage: event.usage, costUsd: event.usage.costUsd };
    case "turnStarted":
    case "turnCompleted":
      // The flat stream needs no turn bookkeeping; parts arrive via partAppended.
      return detail;
  }
}

/** Fold one stream event into a runs-list row (live status/cost updates). */
export function applyRunEventToSummary(summary: RunSummary, event: RunStreamEvent, now: Date): RunSummary {
  switch (event.type) {
    case "runStatus": {
      const run = event.run;
      return {
        ...summary,
        status: run.status,
        startedAt: run.startedAt ?? summary.startedAt,
        endedAt: run.endedAt,
        durationMs: durationMsOf(run, now) ?? summary.durationMs,
        costUsd: run.usage.costUsd > 0 ? run.usage.costUsd : summary.costUsd,
      };
    }
    case "usage":
      return { ...summary, costUsd: event.usage.costUsd };
    default:
      return summary;
  }
}
