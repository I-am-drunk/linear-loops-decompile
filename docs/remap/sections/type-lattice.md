# TYPE-LATTICE — the WorkflowDefinition `type` dispositions (6 values)

Claimed on #225 at 2026-09-29 by sess_01a0ede8-f9a3-7388-9e07-86b812b9cda3
(the #295 triage-plane input is the research). Evidence: `Issue.DRYymPCa.js`
at `c44f2cf` — enum `uD`/export `y_` (pretty L19992), predicates `gD`/`g_`
(L20133–20141), conversion `_D.resolveTypeForTrigger`/`m_` (L20547, run by
the model's `firstTrigger` setter L35962). Kernel reimplementation with
corpus-exec goldens: `src/loops-type-lattice`.

Every WorkflowDefinition our store accepts carries one of SIX `type` values.
The ledger elsewhere dispositions features; this file dispositions the type
values themselves, so "removed" is a verifiable claim per value, not silence.

**Store rule (applies regardless of the OUT rows):** our WorkflowDefinition
table accepts ALL six values — storing ≠ rendering. A definition seen via
write-back/echo with an OUT type must round-trip unmangled.

| `type` value | Disposition | Golden-req | Data plane | Evidence | Notes |
|---|---|---|---|---|---|
| `automation` | KEEP-EXACT | yes (this kernel + the per-surface rows) | OURS | enum L19992; `isLoop` L35942 | The loop. Owned feature-wise by the R-* shards. |
| `triageAutomation` | KEEP-EXACT | yes (this kernel) | OURS | enum; `isTriage` AND `isAutomation` both true (L20133/20136) | A loop whose trigger is `issue`/`entityInTriage`. DUAL-species: triage predicates and loop predicates both match — permission routing (AutomationHelper L1525: → `automationManagement`) and chrome routing (the `BZ`/`HZ` URL kernel, 14:31Z input) fork on this. The stored value is DERIVED: `resolveTypeForTrigger` converts `automation` ⇄ `triageAutomation` on every trigger write — **our publish/draft endpoint must run this conversion** (interlock: R-DRAFT `publishDraft` spec). |
| `triage` | ADAPT (store + count only) | no | OURS | TeamTriageSettingsPage L481 (default construction), L750 | Team triage RULES ride the same store (exact defaults: `trigger: entityCreatedOrUpdated`, `triggerType: issue`, `activities: [{updateIssue: {property: assignee, value: ''}}]`, firstSortOrder). Not a loop (`isLoop` false). Pending owner-decision #11: we ship the team-settings Loops-count row (`workflowDefinitions.count(type === triageAutomation)`, L1032) and accept `triage` rows in the store; no triage-rules editor. |
| `sla` | OUT | no | N-A | enum; `allowedIssueFilterKeysInSlaCondition` L20125 | SLA automations — not Loops, no loops surface mounts them. One residue: the condition-key helper `getAllowedKeysForWorkflowType` special-cases `sla` (L20120); our validator needs no such branch while the value is OUT. |
| `viewSubscription` | OUT | no | N-A | enum; `isViewSubscription` L20139 | View-subscription definitions — not Loops. The predicate ships in the kernel (it is part of the transcribed surface and costs nothing); no consumer surface ships. |
| `release` | OUT | no | N-A | enum; `allowedReleaseFilterKeysInCondition` L20108 | Release automations — not Loops (release pipelines are out of contract scope). Same condition-key residue note as `sla`. |

## The conversion kernel (golden-backed, `src/loops-type-lattice`)

`resolveTypeForTrigger(type, trigger)`: `automation` + (`trigger.type ===
issue && trigger.event === entityInTriage`) → `triageAutomation`;
`triageAutomation` + anything else → `automation`; identity for the other
four values. Negative pins in the golden grid: a non-issue trigger type never
yields `triageAutomation` even with the `entityInTriage` event, and a missing
event never converts. Related exact facts owned elsewhere: `eventToTrigger`
maps `entityInTriage → entityCreatedOrUpdated` for STORAGE (L20208) and
`toTrigger` re-derives the `entityInTriage` event from `isTriage(type)` when
projecting back (L20271) — the round-trip pair belongs to R-triggers' rows;
the `triageStateCondition` literal (L35974) it appends is R-triggers evidence
too. Cross-link, don't duplicate.
