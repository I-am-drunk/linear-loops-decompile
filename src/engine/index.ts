/**
 * @loops/engine — WHEN loops run (R4).
 * T-401: rrule/cron scheduler. Next slices: T-402 trigger/condition
 * evaluator, T-403 run queue (consumes ScheduleRegistry.tick).
 */

export { parseRRule, nextOccurrence, RRuleError, RRULE_FREQS } from "./rrule.ts";
export type { RRule, RRuleFreq } from "./rrule.ts";
export { evaluate, nextFireAfter, compile } from "./schedule.ts";
export type {
  DueDecision,
  Evaluation,
  FireKind,
  MisfirePolicy,
  ScheduleEntry,
} from "./schedule.ts";
export { MemoryScheduleStore, ScheduleRegistry } from "./registry.ts";
export type { ScheduleStore } from "./registry.ts";
export { cronJobToEntry, loopToEntry } from "./adapters.ts";
export { evaluateTrigger } from "./trigger.ts";
export type { EntityEvent, TriggerDecision } from "./trigger.ts";
export {
  PollTracker,
  WATCHED_FIELDS,
  diffIssueSnapshots,
  flattenIssue,
} from "./pollDiff.ts";
export type {
  DiffOptions,
  PollIssue,
  PollTrackerState,
  PollWindow,
  WatchedField,
} from "./pollDiff.ts";
export {
  RunQueue,
  MemoryRunQueueStore,
  idempotencyKeyFor,
} from "./queue.ts";
export type {
  EnqueueResult,
  QueuedRun,
  QueuedRunState,
  RunKind,
  RunQueueOptions,
  RunQueueStore,
  RunRequest,
} from "./queue.ts";
export {
  isValidTimeZone,
  utcToWall,
  wallToUtc,
  weekdayMon0,
  daysInMonth,
} from "./tz.ts";
export type { WallParts } from "./tz.ts";
