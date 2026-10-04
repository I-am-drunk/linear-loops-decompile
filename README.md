# linear-loops-decompile

A self-hosted, original reimplementation of Linear's UI, with a
workflow-automation page at its centre. You run it on your own server and
connect your own Linear account.

New here? Read `prompt.md` — it is the whole onboarding.

## What we are building

**Linear's UI, ours.** Sidebar, navigation, theme, settings, the surfaces a
workspace actually uses. It should look and feel like Linear.

**An automations page better than Linear's.** The centrepiece is a workflow
automation surface built on Cursor's automations layout rather than Linear's
Loops layout, because that layout is better: one MCP configuration per
automation, multi-trigger forms, chained prompts with per-step model choice.
See `docs/plan/automations.md`.

**Integrations as a feature, not a thesis.** Linear is one integration among
several — you sign in, we read and write your workspace through the public
API. It is not the product's foundation. `docs/plan/integrations.md`.

**Inference you choose.** T3 Code Connect is a first-class provider alongside
API-key and local harnesses, configured in a Linear-style settings UI.
`docs/plan/inference.md`.

## Provenance

Read `docs/PROVENANCE.md` before any extraction work. Short version: this repo
is public, so we build from open specifications, public documentation, and the
product as a user sees it. Reading a shipped bundle locally to understand
behavior is fine. Publishing a byte-fidelity transcription of its internals is
not, and "facts, not code" does not change that. The rule exists because the
old method was both a legal exposure and a source of confidently wrong facts —
that history is in `docs/LEARNINGS.md`.

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
| `docs/PROVENANCE.md` | where facts may come from |
| `docs/LEARNINGS.md` | 121 issues and 300+ thread comments, distilled |
| `docs/plan/` | one design doc per lane |
| `src/` | our code |
| `extracts/linear-official/` | Linear's own MIT-licensed schema, SDK and docs digests |
| `pipeline/`, `tools/` | local analysis harness (`corpus/` is gitignored, never committed) |
| `archive/` | superseded docs and eras |
| `ci/` | the gate: `bash ci/check-src.sh` |
