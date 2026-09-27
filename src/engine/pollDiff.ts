/**
 * Poll-diff bridge (M5, R4) — turns the dataplane's poll snapshots into
 * engine EntityEvents.
 *
 * Why this exists: the dataplane's poll fallback (`pollIssueChanges`,
 * src/dataplane/webhooks.ts) answers "which issues changed since <watermark>"
 * and explicitly assigns POLICY to the engine: "The engine owns diffing
 * (collectionChanged vs watchedPropertyChanged) and the poll loop itself;
 * this file is the plumbing, not the policy." This module is that policy.
 *
 * What it does, per poll window:
 * - baseline silence: the FIRST observed snapshot emits nothing — loops must
 *   never fire on the whole backlog just because the server booted.
 * - created vs first-seen-old: an issue absent from the previous snapshot is
 *   `created` when its createdAt is newer than the previous watermark, else a
 *   plain `updated` with `changedProperties: undefined` — the trigger
 *   evaluator fails watchedPropertyChanged loops CLOSED on unknown diffs
 *   (trigger.ts), which is the safe direction for an issue we never saw.
 * - field diffs: the eight WATCHED_FIELDS use the SAME flattened vocabulary
 *   as the `properties` snapshot (title, description, priority, estimate,
 *   dueDate, stateId, assigneeId, teamId), so watchedProperties conditions
 *   and propertyFilter conditions share one namespace (trigger.test.ts
 *   established that vocabulary: "stateId", "assigneeId").
 * - label membership: `labels` is a COLLECTION, so label gain/loss emits
 *   collectionChange events (added and removed as separate events —
 *   evaluateTrigger checks one operation per event), never a watched-field
 *   diff. Loops watching labels belong to collectionChanged mode.
 * - triage: state.type transitioning into "triage" emits a dedicated
 *   `inTriage` event (the SPECS/loops.md triage variant).
 * - activity touches: when the poll returns an issue whose diffed fields are
 *   all unchanged (e.g. a comment bumped updatedAt), an `updated` event with
 *   `changedProperties: []` still fires — Linear's Issue webhook fires on
 *   comment creation, so propertyFilter loops re-evaluate the snapshot while
 *   watchedPropertyChanged loops correctly do not fire ("diffed, nothing
 *   watched changed").
 * - event ids: `poll:issue:{id}:{updatedAt}` (+ `:labels-added` /
 *   `:labels-removed` / `:inTriage` facet). Stable across replays of the same
 *   poll window, so the run queue's idempotency key (hash of
 *   loopId+triggerEventId, queue.ts) collapses duplicates for free.
 *
 * What it deliberately does not do:
 * - deletions: the poll read cannot see them (absence ≠ deleted — an issue
 *   simply outside the window looks identical). Webhook delivery would carry
 *   removals; documented limitation of the fallback, same as the dataplane's.
 * - label-membership events for CREATED issues (v1 simplification: creation
 *   with labels does not synthesize labels-added events).
 * - entities other than issues: the poll fallback only reads issues (v1).
 *
 * Structural typing, zero cross-package import: `PollIssue` mirrors the
 * dataplane's `IssueSummary` field-for-field, so `PollResult.issues` is
 * directly assignable here (the T-304 pattern). The orchestrator (T-1102,
 * src/server) drives: poll → `PollTracker.observe(result)` → evaluateTrigger
 * per event-triggered loop → enqueue firing decisions.
 */

import type { EntityEvent } from "./trigger.ts";

/**
 * Structural mirror of src/dataplane's IssueSummary. Keep in sync: the server
 * is where a drift would type-error (the T-304 seam pattern).
 */
export interface PollIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string | null | undefined;
  priority: number;
  estimate?: number | null | undefined;
  dueDate?: string | null | undefined;
  url: string;
  createdAt: string;
  updatedAt: string;
  state: { id: string; name: string; type: string };
  team: { id: string; key: string };
  assignee?: { id: string; displayName: string } | null | undefined;
  labels: { id: string; name: string }[];
}

/** A poll result, structurally identical to the dataplane's PollResult. */
export interface PollWindow {
  issues: readonly PollIssue[];
  watermark: string;
}

/**
 * The eight scalar fields whose changes populate `changedProperties`, in the
 * flattened vocabulary shared with the `properties` snapshot (so
 * watchedProperties and propertyFilter conditions read one namespace).
 */
export const WATCHED_FIELDS = [
  "title",
  "description",
  "priority",
  "estimate",
  "dueDate",
  "stateId",
  "assigneeId",
  "teamId",
] as const;
export type WatchedField = (typeof WATCHED_FIELDS)[number];

type Scalar = string | number | null;

function watchedValue(issue: PollIssue, field: WatchedField): Scalar {
  switch (field) {
    case "title":
      return issue.title;
    case "description":
      return issue.description ?? null;
    case "priority":
      return issue.priority;
    case "estimate":
      return issue.estimate ?? null;
    case "dueDate":
      return issue.dueDate ?? null;
    case "stateId":
      return issue.state.id;
    case "assigneeId":
      return issue.assignee?.id ?? null;
    case "teamId":
      return issue.team.id;
  }
}

/**
 * The flat property snapshot carried on every emitted event, for
 * propertyFilter conditions. Includes display fields alongside the watched
 * ids; null/undefined values are OMITTED so filters on absent properties fail
 * closed with "property unknown" (the safe direction).
 */
export function flattenIssue(
  issue: PollIssue,
): Record<string, string | number | boolean | string[]> {
  const out: Record<string, string | number | boolean | string[]> = {
    identifier: issue.identifier,
    title: issue.title,
    priority: issue.priority,
    stateId: issue.state.id,
    stateName: issue.state.name,
    stateType: issue.state.type,
    teamId: issue.team.id,
    teamKey: issue.team.key,
    labels: issue.labels.map((l) => l.name),
    labelIds: issue.labels.map((l) => l.id),
    url: issue.url,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
  };
  if (issue.description != null) out["description"] = issue.description;
  if (issue.estimate != null) out["estimate"] = issue.estimate;
  if (issue.dueDate != null) out["dueDate"] = issue.dueDate;
  if (issue.assignee != null) {
    out["assigneeId"] = issue.assignee.id;
    out["assigneeName"] = issue.assignee.displayName;
  }
  return out;
}

export interface DiffOptions {
  /**
   * The watermark of the PREVIOUS poll window. Issues absent from `prev` with
   * `createdAt` newer than this are `created`; older ones are first-seen-old
   * `updated` events with `changedProperties: undefined`. When omitted, every
   * absent-from-`prev` issue is treated as first-seen-old (fail closed).
   */
  prevWatermark?: string | undefined;
}

/**
 * The pure diff: previous snapshot (by issue id) × newly polled issues →
 * EntityEvents, in `next` order (oldest-updated first, matching the
 * dataplane's ordering). See the file header for the full semantics.
 */
export function diffIssueSnapshots(
  prev: ReadonlyMap<string, PollIssue>,
  next: readonly PollIssue[],
  options: DiffOptions = {},
): EntityEvent[] {
  const events: EntityEvent[] = [];
  for (const issue of next) {
    const base = `poll:issue:${issue.id}:${issue.updatedAt}`;
    const properties = flattenIssue(issue);
    const teamId = issue.team.id;
    const before = prev.get(issue.id);

    if (!before) {
      const isCreated =
        options.prevWatermark !== undefined && issue.createdAt > options.prevWatermark;
      events.push({
        id: base,
        entity: "issue",
        kind: isCreated ? "created" : "updated",
        entityId: issue.id,
        // First-seen-old: no diff information exists — watchedPropertyChanged
        // loops fail closed on undefined (trigger.ts).
        changedProperties: isCreated ? [] : undefined,
        properties,
        teamId,
      });
      continue;
    }

    // Identical updatedAt = the exact same state re-observed (a replayed or
    // overlapping poll window): nothing new, no event — replays are silent
    // even before the run queue's idempotency key gets a say.
    if (issue.updatedAt === before.updatedAt) continue;

    const changed = WATCHED_FIELDS.filter(
      (f) => watchedValue(before, f) !== watchedValue(issue, f),
    );
    const prevLabelIds = new Set(before.labels.map((l) => l.id));
    const nextLabelIds = new Set(issue.labels.map((l) => l.id));
    const labelsAdded = issue.labels.some((l) => !prevLabelIds.has(l.id));
    const labelsRemoved = before.labels.some((l) => !nextLabelIds.has(l.id));
    const triageEntered = before.state.type !== "triage" && issue.state.type === "triage";

    if (changed.length > 0) {
      events.push({
        id: base,
        entity: "issue",
        kind: "updated",
        entityId: issue.id,
        changedProperties: [...changed],
        properties,
        teamId,
      });
    }
    if (labelsAdded) {
      events.push({
        id: `${base}:labels-added`,
        entity: "issue",
        kind: "updated",
        entityId: issue.id,
        collectionChange: { property: "labels", operation: "added" },
        properties,
        teamId,
      });
    }
    if (labelsRemoved) {
      events.push({
        id: `${base}:labels-removed`,
        entity: "issue",
        kind: "updated",
        entityId: issue.id,
        collectionChange: { property: "labels", operation: "removed" },
        properties,
        teamId,
      });
    }
    if (triageEntered) {
      events.push({
        id: `${base}:inTriage`,
        entity: "issue",
        kind: "inTriage",
        entityId: issue.id,
        properties,
        teamId,
      });
    }
    if (changed.length === 0 && !labelsAdded && !labelsRemoved && !triageEntered) {
      // Activity touch (e.g. a comment bumped updatedAt): fire `updated` with
      // an empty diff — see the file header for why.
      events.push({
        id: base,
        entity: "issue",
        kind: "updated",
        entityId: issue.id,
        changedProperties: [],
        properties,
        teamId,
      });
    }
  }
  return events;
}

/** Persisted tracker state (one JSON blob per poll scope, e.g. per team). */
export interface PollTrackerState {
  /** Last poll watermark; null before the first observe (unprimed). */
  watermark: string | null;
  /** The previous snapshot (newest known state per issue id). */
  issues: PollIssue[];
}

/**
 * The stateful poll-loop helper: holds the previous snapshot + watermark and
 * turns each poll window into EntityEvents. The first `observe` after
 * construction is a BASELINE (emits nothing) — loops never fire on backlog.
 *
 * Durability: the orchestrator persists `toJSON()` after each poll and
 * restores with `fromJSON` on boot. If the state is lost, the tracker simply
 * re-baselines — a window's events are SKIPPED, never double-fired (the
 * fail-safe direction for automation).
 */
export class PollTracker {
  private snapshot = new Map<string, PollIssue>();
  private watermarkValue: string | null;

  constructor(state?: PollTrackerState) {
    if (state) {
      this.watermarkValue = state.watermark;
      for (const issue of state.issues) this.snapshot.set(issue.id, issue);
    } else {
      this.watermarkValue = null;
    }
  }

  /** True once the tracker has observed at least one window. */
  get primed(): boolean {
    return this.watermarkValue !== null;
  }

  /** The current watermark (pass it as `since` to the next poll). */
  get watermark(): string | null {
    return this.watermarkValue;
  }

  /** The previous snapshot, by issue id (read-only view). */
  issues(): ReadonlyMap<string, PollIssue> {
    return this.snapshot;
  }

  /**
   * Fold one poll window into the tracker. Returns the EntityEvents for this
   * window (empty on the baseline call). The watermark never moves backward.
   */
  observe(window: PollWindow): EntityEvent[] {
    const events = this.primed
      ? diffIssueSnapshots(this.snapshot, window.issues, {
          prevWatermark: this.watermarkValue ?? undefined,
        })
      : [];
    for (const issue of window.issues) this.snapshot.set(issue.id, issue);
    if (this.watermarkValue === null || window.watermark > this.watermarkValue) {
      this.watermarkValue = window.watermark;
    }
    return events;
  }

  toJSON(): PollTrackerState {
    return { watermark: this.watermarkValue, issues: [...this.snapshot.values()] };
  }

  static fromJSON(state: PollTrackerState): PollTracker {
    return new PollTracker(state);
  }
}
