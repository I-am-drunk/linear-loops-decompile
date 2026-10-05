# linear-loops-decompile

A self-hosted, original reimplementation of Linear's UI, with a
workflow-automation page at its centre. You run it on your own server and
connect your own Linear account.

New here? Read `prompt.md` — it is the whole onboarding.

## What we are building

**Linear's UI, ours.** Sidebar, navigation, theme, settings, the surfaces a
workspace actually uses. It should look and feel like Linear.

**An automations page on Cursor's layout.** The centrepiece is a workflow
automation surface built on Cursor's automations layout rather than Linear's
Loops layout (owner's directive). What we build: one MCP configuration per
automation, multiple triggers, chained prompts with per-step model choice.
`docs/plan/automations.md` records which of those are established facts about
either product and which are simply what we want.

**Integrations as a feature, not a thesis.** Linear is one integration among
several — you sign in, we read and write your workspace through the public
API. It is not the product's foundation. `docs/plan/integrations.md`.

**Inference you choose.** T3 Code Connect is a first-class provider alongside
API-key and local harnesses, configured in a Linear-style settings UI.
`docs/plan/inference.md`.

## Provenance

Our method is exact reproduction. We decompile Linear's shipped client into
`pipeline/corpus/` (local, gitignored), read the real values out of it, and
write our own original code that produces those exact values. Every UI value
is cited, and `ci/check-ui.sh` checks that. It is a local gate, not a CI one
yet (issue #331).

Read `docs/UI-EXACTNESS.md` before any UI work. Commit only our own code —
never Linear's bundles or source.

## Status

Rearchitected 2026-10-04: scope widened from Loops-only to the whole Linear
UI, the automations page re-based on Cursor's layout, and the
decompile-and-publish method retired. Board: `STATUS.md`. Plan: `PLAN.md`.

## Repo map

| Path | What |
|---|---|
| `prompt.md` | the session prompt — paste it into a new session |
| `AGENTS.md` | how to work here |
| `PLAN.md` | the lanes and their slices |
| `STATUS.md` | the board |
| `docs/UI-EXACTNESS.md` | **read before any UI work** — how to get a value and cite it |
| `docs/LEARNINGS.md` | 121 issues and 300+ thread comments, distilled |
| `docs/plan/` | one design doc per lane |
| `src/` | our code |
| `extracts/linear-official/` | Linear's own MIT-licensed schema, SDK and docs digests |
| `pipeline/`, `tools/` | local analysis harness (`corpus/` is gitignored, never committed) |
| `archive/` | superseded docs and eras |
| `ci/` | the gate: `bash ci/check-src.sh` |
