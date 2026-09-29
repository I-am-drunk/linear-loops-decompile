// Hand-written drive-mode driver for Issue.DRYymPCa.js (TYPE-LATTICE claim,
// #225 2026-09-29; original code). Drives four exports of the model-layer
// chunk, all pure statics/data over their arguments:
//   y_ (local uD, pretty L19992) — the six-value WorkflowDefinition type enum.
//   g_ (local gD)   — isTriage (L20133), isAutomation (L20136),
//                     isViewSubscription (L20139).
//   m_ (local _D)   — resolveTypeForTrigger (L20547): automation ⇄
//                     triageAutomation derived from an issue/entityInTriage
//                     trigger; identity for every other type.
//   T_ (local iD, L19928) — the trigger entity-type enum the guard compares
//                     against (recorded so the fixture keys are corpus values,
//                     not authored strings).
// Fixtures: the full 6-type predicate sweep, and resolveTypeForTrigger over
// the 6-type × {issue/entityInTriage, issue/entityUpdated,
// project/entityInTriage, schedule/undefined-event} grid — the conversion's
// both directions, the identity rows, and the two negative pins that matter:
// a non-issue trigger type never yields triageAutomation even with the
// entityInTriage event, and a missing event never converts.
export default async ({ entry }) => {
  const typeEnum = entry.y_;
  const predicates = entry.g_;
  const triggerHelper = entry.m_;
  const entityType = entry.T_;

  const types = [`sla`, `automation`, `viewSubscription`, `triage`, `triageAutomation`, `release`];

  const sweep = (fn) => Object.fromEntries(types.map((t) => [t, fn(t)]));

  const triggers = {
    issueInTriage: { type: entityType.issue, event: `entityInTriage` },
    issueUpdated: { type: entityType.issue, event: `entityUpdated` },
    projectInTriage: { type: entityType.project, event: `entityInTriage` },
    scheduleNoEvent: { type: entityType.schedule },
  };

  const resolveGrid = Object.fromEntries(
    Object.entries(triggers).map(([name, trigger]) => [
      name,
      Object.fromEntries(types.map((t) => [t, triggerHelper.resolveTypeForTrigger(t, trigger)])),
    ]),
  );

  return {
    typeEnum: { ...typeEnum },
    entityTypeEnum: { ...entityType },
    isTriage: sweep((t) => predicates.isTriage(t)),
    isAutomation: sweep((t) => predicates.isAutomation(t)),
    isViewSubscription: sweep((t) => predicates.isViewSubscription(t)),
    resolveTypeForTrigger: resolveGrid,
  };
};
