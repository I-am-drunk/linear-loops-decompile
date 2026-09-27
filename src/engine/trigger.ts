/**
 * Trigger + condition evaluator (T-402) — decides WHETHER an entity event
 * starts a loop run. Pure function; the dataplane (R3) supplies events, the
 * run queue (T-403) consumes `execution` from firing decisions.
 *
 * Condition semantics verified against the Linear 1.32.4 corpus
 * (agent-04@E1's extract, hub #21 2026-09-26 23:12Z + SPECS/loops.md):
 * - `watchedPropertyChanged` fires only when a watched property actually
 *   changed (requires the dataplane's property diff — fail closed without it).
 * - `collectionChanged` fires on membership gain/loss of the named property.
 * - `commentMatch` is honored as the FIRST condition only, and only for
 *   comment-created events (Linear's own rule).
 * - ALL conditions must pass; every decision carries human-readable reasons.
 */

import type {
  CollectionChangeOperation,
  EntityId,
  LoopCondition,
  LoopEventEntity,
  LoopEventKind,
  LoopRunTarget,
  WorkflowDefinition,
} from "../model/index.ts";

/** One observed change from the dataplane (webhook delivery or poll diff). */
export interface EntityEvent {
  /** Dataplane delivery id — T-403 hashes (loopId, id) into the idempotency key. */
  id: string;
  entity: LoopEventEntity;
  kind: LoopEventKind;
  entityId: EntityId;
  /** Properties whose values changed (required for watchedPropertyChanged loops). */
  changedProperties?: string[] | undefined;
  /** Membership change on a collection property (for collectionChanged loops). */
  collectionChange?: { property: string; operation: "added" | "removed" } | undefined;
  /** The new comment, for comment-created events. */
  comment?: { body: string; authorId?: EntityId | undefined } | undefined;
  /** A chat/mention wake, for chat-triggered loops. */
  chatMessage?: { body: string; channel?: string | undefined } | undefined;
  /** External source/integration key; absent = first-party Linear event. */
  sourceKey?: string | undefined;
  /** Current property snapshot, for propertyFilter conditions. */
  properties?: Record<string, string | number | boolean | string[]> | undefined;
  /** The entity's team, for team-scoped loops. */
  teamId?: EntityId | undefined;
  /** Ancestor team ids (nearest first) — used when applyToSubTeams is set. */
  teamAncestorIds?: EntityId[] | undefined;
}

export interface TriggerDecision {
  fire: boolean;
  /** Why/why-not, in evaluation order — surfaced in run history + debugging. */
  reasons: string[];
  /** Present iff fire: what the run queue needs to create the execution. */
  execution?: {
    loopId: EntityId;
    triggerEventId: string;
    target: LoopRunTarget;
  } | undefined;
}

const NOFIRE = (reasons: string[]): TriggerDecision => ({ fire: false, reasons });

/**
 * Evaluate one event against one loop. `loop` is the LIVE definition (config
 * already validated by the zod write-gate — this function re-checks nothing
 * the schema guarantees, but stays total: it never throws on odd events).
 */
export function evaluateTrigger(loop: WorkflowDefinition, event: EntityEvent): TriggerDecision {
  const reasons: string[] = [];

  if (loop.archivedAt) return NOFIRE(["loop is archived"]);
  if (!loop.enabled) return NOFIRE(["loop is disabled"]);

  // Team scope (applyToSubTeams widens to descendant teams).
  if (loop.teamId) {
    const inScope = event.teamId === loop.teamId ||
      (loop.applyToSubTeams && (event.teamAncestorIds ?? []).includes(loop.teamId));
    if (!inScope) return NOFIRE([`event is outside the loop's team scope (${loop.teamId})`]);
  }

  // Trusted sources: an external source key must be allowlisted on the loop.
  if (event.sourceKey && !loop.trustedSourceKeys.includes(event.sourceKey)) {
    return NOFIRE([`source "${event.sourceKey}" is not in the loop's trusted sources`]);
  }

  const trigger = loop.trigger;
  if (trigger.type === "schedule") {
    return NOFIRE(["schedule-triggered loops ignore entity events"]);
  }
  if (trigger.type === "chat") {
    if (!event.chatMessage) return NOFIRE(["chat trigger needs a chat/mention event"]);
    return fire(loop, event, reasons, "chat message received");
  }

  // trigger.type === "event"
  if (event.entity !== trigger.event.entity || event.kind !== trigger.event.kind) {
    return NOFIRE([
      `event ${event.entity}.${event.kind} does not match trigger ${trigger.event.entity}.${trigger.event.kind}`,
    ]);
  }

  for (const [i, condition] of loop.conditions.entries()) {
    const verdict = checkCondition(condition, i, trigger.activationMode, event);
    reasons.push(verdict.reason);
    if (!verdict.pass) return NOFIRE(reasons);
  }
  return fire(loop, event, reasons, "all conditions passed");
}

function fire(loop: WorkflowDefinition, event: EntityEvent, reasons: string[], why: string): TriggerDecision {
  reasons.push(why);
  return {
    fire: true,
    reasons,
    execution: {
      loopId: loop.id,
      triggerEventId: event.id,
      target: { entityType: event.entity, entityId: event.entityId },
    },
  };
}

function checkCondition(
  condition: LoopCondition,
  index: number,
  activationMode: "collectionChanged" | "watchedPropertyChanged",
  event: EntityEvent,
): { pass: boolean; reason: string } {
  switch (condition.kind) {
    case "watchedProperties": {
      if (activationMode !== "watchedPropertyChanged") {
        return { pass: false, reason: "watchedProperties condition requires watchedPropertyChanged mode" };
      }
      const changed = event.changedProperties;
      if (!changed) {
        // Fail closed: without the property diff we cannot know — the
        // dataplane must supply it for watchedPropertyChanged loops.
        return { pass: false, reason: "dataplane supplied no property diff (fail closed)" };
      }
      const hit = condition.properties.filter((p) => changed.includes(p));
      return hit.length > 0
        ? { pass: true, reason: `watched properties changed: ${hit.join(", ")}` }
        : { pass: false, reason: `no watched property changed (changed: ${changed.join(", ") || "none"})` };
    }
    case "collectionChange": {
      if (activationMode !== "collectionChanged") {
        return { pass: false, reason: "collectionChange condition requires collectionChanged mode" };
      }
      const cc = event.collectionChange;
      if (!cc) return { pass: false, reason: "event carries no collection change" };
      const opMatches = (op: CollectionChangeOperation) =>
        op === "addedOrRemoved" || op === cc.operation;
      return cc.property === condition.property && opMatches(condition.operation)
        ? { pass: true, reason: `collection "${cc.property}" ${cc.operation}` }
        : { pass: false, reason: `collection change ${cc.property}.${cc.operation} ≠ ${condition.property}.${condition.operation}` };
    }
    case "commentMatch": {
      // Corpus rule: honored as the FIRST condition only, and only on
      // comment-created events.
      if (index !== 0) {
        return { pass: false, reason: "commentMatch is only honored as the first condition" };
      }
      if (!(event.entity === "comment" && event.kind === "created") || !event.comment) {
        return { pass: false, reason: "commentMatch requires a comment-created event" };
      }
      if (condition.isRegex) {
        let re: RegExp;
        try {
          re = new RegExp(condition.pattern);
        } catch {
          return { pass: false, reason: "commentMatch regex does not compile (write-gate bug)" };
        }
        return re.test(event.comment.body)
          ? { pass: true, reason: "comment matches regex" }
          : { pass: false, reason: "comment does not match regex" };
      }
      return event.comment.body.includes(condition.pattern)
        ? { pass: true, reason: "comment contains the pattern" }
        : { pass: false, reason: "comment does not contain the pattern" };
    }
    case "propertyFilter": {
      const value = event.properties?.[condition.property];
      if (value === undefined) {
        return { pass: false, reason: `property "${condition.property}" unknown in the event snapshot` };
      }
      const pass = compareProperty(value, condition.op, condition.value);
      return {
        pass,
        reason: `property "${condition.property}" ${pass ? "passes" : "fails"} ${condition.op}`,
      };
    }
  }
}

function compareProperty(
  value: string | number | boolean | string[],
  op: "eq" | "neq" | "in" | "contains",
  expected: string | number | boolean | string[],
): boolean {
  switch (op) {
    case "eq":
      return value === expected;
    case "neq":
      return value !== expected;
    case "in":
      return Array.isArray(expected) && expected.some((v) => v === value);
    case "contains":
      if (Array.isArray(value)) return value.some((v) => v === expected);
      if (typeof value === "string" && typeof expected === "string") return value.includes(expected);
      return false;
  }
}
