/**
 * T-1104 — pure mappers: wire records → the pages' view models.
 *
 * The runs/loops pages are presentational (house rule: pages never fetch);
 * these functions are the entire translation layer between the runtime's
 * records (src/runtime types, carried on the wire) and the flat props the
 * pages render. Pure + free of enums/namespaces so they run under
 * `node --experimental-strip-types --test`.
 */
import type { LoopSummary, LastRunInfo } from "../features/loops/types.ts";
import type {
  ActivityItem,
  RunDetail,
  RunSummary,
  RunTarget,
} from "../features/loops/runs/types.ts";
import type { Part, RunUsage } from "../../../runtime/types.ts";
import type { WireLoop, WireRun, WireRunEvent, WireTurn } from "./contract.ts";

/** Parts per turn get a thousand position slots — ample, keeps order stable. */
const TURN_STRIDE = 1000;

function durationMsOf(startedAt: string | undefined, endedAt: string | undefined): number | undefined {
  if (startedAt === undefined || endedAt === undefined) return undefined;
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : undefined;
}

function targetOf(run: WireRun): RunTarget | undefined {
  const target = run.target;
  if (target === undefined) return undefined;
  return { entityType: target.entity, label: target.label ?? target.id };
}

/** Runtime run → one row in the runs list. `loopName` is pre-joined. */
export function wireRunToSummary(run: WireRun, loopName: string): RunSummary {
  const durationMs = durationMsOf(run.startedAt, run.endedAt);
  const target = targetOf(run);
  return {
    id: run.id,
    loopId: run.loopId,
    loopName,
    status: run.status,
    ...(target !== undefined ? { target } : {}),
    createdAt: run.createdAt,
    ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
    ...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    ...(run.usage.costUsd > 0 ? { costUsd: run.usage.costUsd } : {}),
  };
}

/** Server loop row → one row in the loops list. Display joins (owner/team)
 *  arrive pre-resolved on the wire when the server can resolve them. */
export function wireLoopToSummary(loop: WireLoop, lastRun: WireRun | undefined): LoopSummary {
  const cfg = loop.config;
  const last: LastRunInfo | undefined =
    lastRun === undefined
      ? undefined
      : {
          status: lastRun.status,
          at: lastRun.endedAt ?? lastRun.startedAt ?? lastRun.createdAt,
          ...(durationMsOf(lastRun.startedAt, lastRun.endedAt) !== undefined
            ? { durationMs: durationMsOf(lastRun.startedAt, lastRun.endedAt)! }
            : {}),
        };
  return {
    id: loop.id,
    name: loop.name || cfg.name,
    ...(cfg.icon !== undefined ? { icon: cfg.icon } : {}),
    ...(cfg.color !== undefined ? { color: cfg.color } : {}),
    ...(cfg.description !== undefined ? { description: cfg.description } : {}),
    ...(cfg.groupName !== undefined ? { groupName: cfg.groupName } : {}),
    ...(loop.teamName !== undefined ? { teamName: loop.teamName } : {}),
    ownerName: loop.ownerName ?? "",
    enabled: loop.enabled,
    trigger: cfg.trigger,
    ...(last !== undefined ? { lastRun: last } : {}),
  };
}

/** Synthesize the flat activity stream for a finished/historical run. Ids are
 *  `${turnId}#${partIndex}` — the same scheme the live reducer uses, so a
 *  replayed tail never double-renders. */
export function turnsToActivities(turns: readonly WireTurn[]): ActivityItem[] {
  const items: ActivityItem[] = [];
  const ordered = [...turns].sort((a, b) => a.position - b.position);
  for (const turn of ordered) {
    turn.parts.forEach((part, index) => {
      items.push(partToActivityItem(part, `${turn.id}#${index}`, turn.position * TURN_STRIDE + index));
    });
  }
  return items.sort((a, b) => a.position - b.position);
}

function partToActivityItem(part: Part, id: string, position: number): ActivityItem {
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
        ...(part.argsSummary !== undefined ? { argsSummary: part.argsSummary } : {}),
        ...(part.resultSummary !== undefined ? { resultSummary: part.resultSummary } : {}),
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
        ...(part.choices !== undefined ? { choices: part.choices } : {}),
      };
    case "error":
      return { kind: "error", id, position, message: part.message };
    case "steered":
      return { kind: "steered", id, position, text: part.text };
  }
}

/** Initial detail for a run fetched with its history (runs.get). */
export function wireRunToDetail(
  run: WireRun,
  turns: readonly WireTurn[],
  loopName: string,
): RunDetail {
  return {
    ...wireRunToSummary(run, loopName),
    ...(run.summary !== undefined ? { summary: run.summary } : {}),
    ...(run.usage.inputTokens > 0 || run.usage.outputTokens > 0 || run.usage.costUsd > 0
      ? { usage: { inputTokens: run.usage.inputTokens, outputTokens: run.usage.outputTokens, costUsd: run.usage.costUsd } }
      : {}),
    ...(run.error !== undefined ? { error: run.error } : {}),
    activities: turnsToActivities(turns),
  };
}

/**
 * Fold a live event stream into a RunDetail. The channel replays from
 * `sinceSeq` after a reconnect and dedupes by seq (src/connect/client.ts), so
 * the reducer stays seq-agnostic; turn/part bookkeeping lives here so live
 * parts land exactly after their historical predecessors.
 */
export interface RunDetailReducer {
  readonly detail: RunDetail;
  apply(event: WireRunEvent): RunDetail;
}

export function createRunDetailReducer(initial: RunDetail): RunDetailReducer {
  let detail = initial;
  const turnPosition = new Map<string, number>();
  const turnPartCount = new Map<string, number>();
  // Seed from the initial stream so late-arriving parts index correctly.
  for (const item of initial.activities) {
    const sep = item.id.lastIndexOf("#");
    if (sep <= 0) continue;
    const turnId = item.id.slice(0, sep);
    const index = Number(item.id.slice(sep + 1));
    if (!Number.isInteger(index)) continue;
    turnPartCount.set(turnId, Math.max(turnPartCount.get(turnId) ?? 0, index + 1));
    turnPosition.set(turnId, Math.floor(item.position / TURN_STRIDE));
  }

  function apply(event: WireRunEvent): RunDetail {
    switch (event.type) {
      case "runStatus": {
        const run = event.run;
        const durationMs = durationMsOf(run.startedAt, run.endedAt);
        detail = {
          ...detail,
          status: run.status,
          ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
          ...(run.endedAt !== undefined ? { endedAt: run.endedAt } : {}),
          ...(durationMs !== undefined ? { durationMs } : {}),
          ...(run.summary !== undefined ? { summary: run.summary } : {}),
          ...(run.error !== undefined ? { error: run.error } : {}),
          ...(run.usage.costUsd > 0 ? { costUsd: run.usage.costUsd } : {}),
          usage: usageOf(run.usage),
        };
        break;
      }
      case "turnStarted": {
        turnPosition.set(event.turn.id, event.turn.position);
        turnPartCount.set(event.turn.id, event.turn.parts.length);
        // Parts already on the turn at start are part of history; render them.
        if (event.turn.parts.length > 0) {
          const items = event.turn.parts.map((part, index) =>
            partToActivityItem(part, `${event.turn.id}#${index}`, event.turn.position * TURN_STRIDE + index),
          );
          detail = { ...detail, activities: mergeActivities(detail.activities, items) };
        }
        break;
      }
      case "partAppended": {
        const index = turnPartCount.get(event.turnId) ?? 0;
        const position = (turnPosition.get(event.turnId) ?? 0) * TURN_STRIDE + index;
        const item = partToActivityItem(event.part, `${event.turnId}#${index}`, position);
        turnPartCount.set(event.turnId, index + 1);
        detail = { ...detail, activities: mergeActivities(detail.activities, [item]) };
        break;
      }
      case "turnCompleted":
        break; // status line on the run carries the visible change
      case "usage": {
        detail = {
          ...detail,
          usage: usageOf(event.usage),
          ...(event.usage.costUsd > 0 ? { costUsd: event.usage.costUsd } : {}),
        };
        break;
      }
    }
    return detail;
  }

  return {
    get detail() {
      return detail;
    },
    apply,
  };
}

function usageOf(usage: RunUsage): { inputTokens: number; outputTokens: number; costUsd: number } {
  return { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costUsd: usage.costUsd };
}

/** Append items, replacing any with the same synthesized id (replay-safe). */
function mergeActivities(
  existing: readonly ActivityItem[],
  incoming: readonly ActivityItem[],
): readonly ActivityItem[] {
  const byId = new Map<string, ActivityItem>();
  for (const item of existing) byId.set(item.id, item);
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((a, b) => a.position - b.position);
}
