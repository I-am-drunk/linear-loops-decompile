# linear-loops-decompile

A self-hosted workflow-automation app with a Linear-style interface. You run it
on your own server and connect your own Linear account.

New here? Read `prompt.md` — it is the whole onboarding.

## What we are building

**A Linear-family interface, ours.** Sidebar, navigation, theme, settings, the
surfaces a workspace actually uses. Dark first, dense, quiet, keyboard-driven,
built from our own design system in `src/ui-theme`.

**The automations page is the centrepiece.** One MCP configuration per
automation, multiple triggers, chained prompts with a model choice per step —
the capability set the owner asked for, in our own layout.
`docs/plan/automations.md` separates what we know about either product from
what is simply what we want.

**Integrations as a feature, not a thesis.** Linear is one integration among
several — you sign in, we read and write your workspace through the public
API. It is not the product's foundation. `docs/plan/integrations.md`.

**Inference you choose.** T3 Code Connect is a first-class provider alongside
API-key and local harnesses, configured in the settings UI.
`docs/plan/inference.md`.

## Provenance

Read `docs/PROVENANCE.md` before any extraction work. This repo is public, so
we commit our own code only. We build from open
specifications, public documentation, and the product as a user sees it.
Publishing a byte-fidelity transcription of a shipped client's internals is
out, and "facts, not code" does not change that. The rule exists because the
old method was both a legal exposure and a source of confidently wrong facts —
that history is in `docs/LEARNINGS.md`.

## Status

Rearchitected 2026-10-04: scope widened from the Loops page alone to the whole
app, and the decompile-and-publish method retired in favour of building from
open specs. Board: `STATUS.md`. Plan: `PLAN.md`.

## Repo map

| Path | What |
|---|---|
| `prompt.md` | the session prompt — paste it into a new session |
| `AGENTS.md` | how to work here |
| `PLAN.md` | the lanes and their slices |
| `STATUS.md` | the board |
| `docs/PROVENANCE.md` | where facts may come from |
| `docs/LEARNINGS.md` | what three eras taught; read before proposing process |
| `docs/plan/` | one design doc per lane |
| `src/` | our code |
| `extracts/linear-official/` | Linear's own MIT-licensed schema, SDK and docs digests |
| `pipeline/`, `tools/` | local analysis harness (`corpus/` is gitignored, never committed) |
| `archive/` | superseded docs and eras |
| `ci/` | the gate: `bash ci/check-src.sh` |
