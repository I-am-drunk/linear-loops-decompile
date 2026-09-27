# SPEC — Loops domain

Behavioral spec for OUR reimplementation, derived from decompiling Linear 1.32.4
(see KNOWLEDGE.md §3). We reproduce behavior in original code.

## Concepts

- **Loop** — a named automation owned by an org/team/project, with: trigger, conditions,
  prompt (rich text), schedule (when triggerType=schedule), activities (what it may do),
  trusted sources, enabled flag, drafts + publish lifecycle, run history.
- **Loop run** — one execution. Has status, started/ended, target entity (issue/project/
  initiative/document/team/cycle/release), a conversation (turns of activities), stats
  (duration, cost), error info. Runs may continue previous runs (continuation).
- **Draft** — edits happen on a draft copy of the loop config; publishing replaces the
  live config. (`WorkflowDefinitionDraft` mirrors every config field.)

## Trigger model (faithful)

CORRECTED 2026-09-27 (audit, docs/audit-2026-09-27.md — the old "event"
triggerType was wrong). Corpus enum (`fD` in `Issue.DRYymPCa.js`, switched on in
`AutomationHelper.B0HEcOoo.js`): triggerType IS the entity, PascalCase strings:

```
triggerType: "Issue" | "Project" | "Document" | "Initiative" | "Team"
           | "Release" | "Cycle" | "Schedule" | "Chat"
schedule:    { rrule-ish; default exists (defaultAutomationSchedule) }   # when Schedule
activationMode (entity triggers): "collectionChanged" | "watchedPropertyChanged"
conditions:  [ { watchedProperties: [...],
                 collectionChange: { property, operation },
                 commentMatch: <string/regex>,
                 filters… } ]
```

Triage is a condition/variant (`entityInTriage`), not a triggerType value.

Chat triggers: loop wakes on @mention/message in an enabled channel.
Triage variant: event `entityInTriage` with triage-state conditions.

## Condition semantics (observed)

- `watchedPropertyChanged`: run only when one of `watchedProperties` changed.
- `collectionChanged`: run when `collectionChange.property` gains/loses members
  (`operation` = added/removed-ish).
- `commentMatch`: run only when a new comment matches.
- Validation is schema-based (zod) — mirror with our own zod schemas (R2).

## Loop config fields we persist (superset of Linear's, minus their server bits)

`name, icon, color, description, groupName, owner, team?, project?, prompt (doc),
triggerType, trigger(event+activationMode), conditions[], schedule?, enabled,
applyToSubTeams, activities[] (capabilities), trustedSourceKeys[], codeAccess: none|read|write,
editAccess, subscribers, stats{…}, lastExecutedAt, version/publishedAt`.

## Run view (what the UI shows per run)

Ordered **activities**: `thought` (reasoning), `action` (tool call w/ label + args summary),
`response` (assistant message), `elicitation` (asks user; run → awaitingInput), `error`,
plus status header (pending/active/awaitingInput/complete/error/canceled), summary,
usage (tokens/cost), target link, cancel + "send follow-up" (steer/continue same run).
Streams live; supports resume.

## Settings surfaces

- Workspace: enable loops; trusted sources allowlist (external sources/integrations that
  may trigger loops); code access (read via code index, write via coding sessions); usage
  history per loop (runs, failures, spend).
- Per-loop: same trusted-source narrowing; subscribers; edit access.

## UI inventory to reproduce (R7)

Loops list (grouped by owner/team, enabled toggle, last-run chip, search/filter);
loop detail (header w/ icon+name+owner, tabs: configuration/runs/stats); editor blocks
(trigger picker, schedule builder, conditions editor, prompt doc editor, activities/
capabilities, trusted sources, danger zone: disable/delete); runs list (status, target,
duration, cost); run detail (activity stream + steer box + cancel); template library
(cards → prefill editor); "New loop" button + first-run scaffolding; empty states
("Loops require the agent feature enabled", plan upsell analog → OUR inference settings).
Copy tone: terse, sentence-case.
