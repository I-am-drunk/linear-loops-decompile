# @loops/engine — the loop scheduler (R4, T-401)

Decides **when** loops run. Original code, zero runtime dependencies, Node 22.

## What's here

- `tz.ts` — wall-clock ↔ UTC conversion for IANA zones using only `Intl`
  (no tz-data dep). Spring-forward-gap wall times convert to `null` (the
  occurrence is skipped); fall-back-ambiguous times resolve to the earliest
  instant.
- `rrule.ts` — minimal RFC 5545: `FREQ=MINUTELY|HOURLY|DAILY|WEEKLY|MONTHLY`,
  `INTERVAL` (phase-locked to the entry's anchor, so restarts never shift
  schedules), `BYDAY` (expands WEEKLY, filters others; rejected for MONTHLY),
  `BYHOUR`, `BYMINUTE`, `COUNT`, `UNTIL`. Unknown parts throw `RRuleError` —
  we fail loudly rather than silently mis-schedule a loop.
- `schedule.ts` — `ScheduleEntry` + `evaluate()`. Misfire policies
  (`skip` default / `catchUp`): Linear collapses missed runs — after downtime
  the schedule jumps forward (ceil(diff/interval)) and missed occurrences are
  never replayed (agent-04's corpus extract, hub #21). `catchUp` additionally
  fires exactly one make-up run for the latest miss.
- `registry.ts` — `ScheduleRegistry.tick(now)` → due fires; waterline
  (`lastFiredAt`) lives in an injectable `ScheduleStore` (the server persists
  it, T-1101; `MemoryScheduleStore` for tests). Ticks are idempotent.
- `adapters.ts` — `loopToEntry(WorkflowDefinition)` /
  `cronJobToEntry(WorkflowCronJobDefinition)` onto @loops/model. Only
  schedule-triggered, enabled, non-archived loops produce entries; the anchor
  is `publishedAt ?? createdAt` (republishing re-phases the schedule).
- `trigger.ts` — `evaluateTrigger(loop, event)` (T-402): event/activation/
  condition gates → `{ fire, reasons[], execution }`. watchedPropertyChanged
  fails closed without a property diff; commentMatch is first-condition-only
  and comment-created-only (Linear's own rule); external events must be in
  `trustedSourceKeys`; team scope honors `applyToSubTeams`.

- `queue.ts` — the run queue (T-403): per-loop + global concurrency caps,
  runs-per-hour and USD-per-day budgets (gated at start time, UTC day
  buckets), idempotency keys (`evt:{loop}:{event}` / `sched:{loop}:{at}`),
  FIFO starts, drain/resume, cancel-waiting. Terminal run state lives with the
  runtime (R5); durable dedup across restarts lives with the server's
  executions table (T-1101) — the queue's key is the value to store there.

## Deliberately not here

Persistence (T-1101's stores implement `ScheduleStore`/`RunQueueStore`), and
Linear's client-side schedule-editor shape (`{type: days|weeks|hours, …}` —
agent-04's extract) which maps onto rrule strings at the UI/config boundary.

## Verify

```
npm install   # root: typescript, @types/node, zod (for ../model)
tsc --noEmit  # in src/engine
node --experimental-strip-types --test *.test.ts   # 54/54
```
