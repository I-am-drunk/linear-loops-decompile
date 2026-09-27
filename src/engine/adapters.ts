/**
 * Adapters from the domain model (@loops/model, R2) to schedule entries.
 * Only schedule-triggered, enabled, non-archived records produce entries;
 * event/chat triggers are the trigger evaluator's business (T-402).
 */

import type { WorkflowCronJobDefinition, WorkflowDefinition } from "../model/index.ts";
import type { ScheduleEntry } from "./schedule.ts";

/**
 * A schedule-triggered loop → its entry, or null when the loop shouldn't be
 * scheduled (disabled, archived, or a non-schedule trigger).
 * Anchor = last publish (else creation): republishing a loop re-phases its
 * schedule, matching how Linear treats schedule edits as new cron state.
 */
export function loopToEntry(loop: WorkflowDefinition): ScheduleEntry | null {
  if (loop.archivedAt || !loop.enabled || loop.trigger.type !== "schedule") return null;
  return {
    id: `loop:${loop.id}`,
    rrule: loop.trigger.schedule.rrule,
    timezone: loop.trigger.schedule.timezone,
    anchor: new Date(loop.publishedAt ?? loop.createdAt),
    enabled: true,
    misfire: "skip", // Linear's collapse semantics (see schedule.ts)
  };
}

/** A standalone cron automation → its entry (null when disabled). */
export function cronJobToEntry(cron: WorkflowCronJobDefinition): ScheduleEntry | null {
  if (!cron.enabled) return null;
  return {
    id: `cron:${cron.id}`,
    rrule: cron.schedule.rrule,
    timezone: cron.schedule.timezone,
    anchor: new Date(cron.createdAt),
    enabled: true,
    misfire: "skip",
  };
}
