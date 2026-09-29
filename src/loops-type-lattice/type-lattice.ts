/**
 * WorkflowDefinition type lattice — clean reimplementation of the type enum
 * and its predicates/conversion kernel from the corpus chunk
 * `Issue.DRYymPCa.js` (pretty L19992 enum `uD`, exported `y_`; predicates on
 * the condition-helper class `gD` L20133–20141, exported `g_`; the
 * publish-time conversion on the trigger-helper class `_D` L20547–20550,
 * exported `m_`). Original code; behavior is verified byte-for-byte against
 * the committed corpus-executed golden (`golden/type-lattice.grid.expected.json`)
 * — see `corpus-manifest.json` and the golden test.
 *
 * Why this kernel is load-bearing (issue #295 triage-plane input, 2026-09-29):
 *   - `type` is SIX-valued: {sla, automation, viewSubscription, triage,
 *     triageAutomation, release}. Loops are `automation` and
 *     `triageAutomation` (the model's `isLoop` getter, L35942, is
 *     `isAutomation` over the stored type); `triage` is the team-settings
 *     triage-rule species riding the same store.
 *   - `isTriage` and `isAutomation` OVERLAP on `triageAutomation`: a
 *     triage-loop is both. Permission routing (AutomationHelper L1525:
 *     automation|triageAutomation → automationManagement, else
 *     teamManagement) and chrome routing (the BZ/HZ URL kernel) fork on
 *     exactly these predicates.
 *   - `resolveTypeForTrigger` runs in the `firstTrigger` SETTER (L35962),
 *     i.e. on every trigger edit/publish: an `automation` whose trigger
 *     becomes `issue`/`entityInTriage` is STORED as `triageAutomation`, and a
 *     `triageAutomation` whose trigger is anything else reverts to
 *     `automation`. Every other type passes through unchanged — the
 *     conversion never touches sla/triage/viewSubscription/release, and a
 *     non-issue trigger type never yields `triageAutomation` even with an
 *     `entityInTriage` event (corpus: the guard is `type === issue &&
 *     event === entityInTriage`, both conjuncts). Our publish endpoint must
 *     run this conversion or a triage-triggered loop lands with the wrong
 *     chrome, settings mount, and permission check.
 */

/** The six-value type enum, values verbatim from the corpus (`uD`, L19992). */
export const WorkflowDefinitionType = {
  sla: `sla`,
  automation: `automation`,
  viewSubscription: `viewSubscription`,
  triage: `triage`,
  triageAutomation: `triageAutomation`,
  release: `release`,
} as const;

export type WorkflowDefinitionType =
  (typeof WorkflowDefinitionType)[keyof typeof WorkflowDefinitionType];

/** The trigger's entity-type vocabulary, the subset this kernel reads
 * (`iD`, L19928 — full enum: issue, project, document, initiative, team,
 * release, cycle, schedule, chat; the conversion guard compares against
 * `issue` only). */
export const TriggerEntityType = {
  issue: `issue`,
  project: `project`,
  document: `document`,
  initiative: `initiative`,
  team: `team`,
  release: `release`,
  cycle: `cycle`,
  schedule: `schedule`,
  chat: `chat`,
} as const;

export type TriggerEntityType = (typeof TriggerEntityType)[keyof typeof TriggerEntityType];

/** The shape `resolveTypeForTrigger` reads from a trigger: its entity type
 * and event name. The corpus passes the editor's trigger value object; only
 * `.type` and `.event` are consulted (both conjuncts read at L20548). */
export interface TriggerLike {
  type: string;
  event?: string | undefined;
}

/** `triage | triageAutomation` — the triage species test (gD.isTriage, L20133). */
export function isTriage(type: string): boolean {
  return type === `triage` || type === `triageAutomation`;
}

/** `automation | triageAutomation` — the loop species test (gD.isAutomation,
 * L20136; the model's `isLoop` getter is this predicate over the stored type). */
export function isAutomation(type: string): boolean {
  return type === `automation` || type === `triageAutomation`;
}

/** `viewSubscription` only (gD.isViewSubscription, L20139). */
export function isViewSubscription(type: string): boolean {
  return type === `viewSubscription`;
}

/**
 * The publish-time auto-conversion (_D.resolveTypeForTrigger, L20547):
 * `automation` + an `issue`/`entityInTriage` trigger → `triageAutomation`;
 * `triageAutomation` + any other trigger → `automation`; every other input
 * type is identity. Runs in the model's `firstTrigger` setter (L35962), so
 * the stored type is DERIVED from the trigger at every trigger write.
 */
export function resolveTypeForTrigger(type: string, trigger: TriggerLike): string {
  const inTriage = trigger.type === TriggerEntityType.issue && trigger.event === `entityInTriage`;
  return type === `automation` && inTriage
    ? `triageAutomation`
    : type === `triageAutomation` && !inTriage
      ? `automation`
      : type;
}
