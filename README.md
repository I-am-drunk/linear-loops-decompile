# linear-loops-decompile

Self-hosted **Linear Loops only**: the exact Linear Loops UI and behavior, rebuilt as
original code and run on your own server with your own Linear account. This is not a
full Linear clone, a lookalike, or a feature-by-feature approximation. The product
surface is Loops plus the views Loops requires, and our own Settings; every shipped
surface is verified against the decompiled app itself. The non-negotiable scope and
credential boundary are defined in `SPECS/product-contract.md`.

## The brain: the golden goose first

Linear's loop chat and normal AI chat are the same substrate, but Loops is
credit-metered. The golden goose (issue #14) is the normal AI chat route the
first-party app uses. Our server drives that route with the user's own Linear session
so self-hosted loops use Linear-grade chat instead of the Loops-metered wrapper.
Proving and integrating that route is the main event.

This is distinct from Linear's public API: a PAT or OAuth token connects the account
for Loops data and write-back; it cannot call the chat route. A user-session bridge is
the separately managed credential for the goose. External inference harnesses
(OpenRouter, LiteLLM, vLLM, Ollama) are supported only as a fallback so a loop remains
runnable when the chat bridge is unavailable; they are not the intended brain.

The public Agent Sessions API is a separate, credit-bearing surface for external
agents. We use it for presenter and write-back integration only, never as the brain.

## How it works

Open our Loops web page (served by our server), connect a Linear account in our
Settings, then connect the chat-session bridge (or explicitly choose a fallback
inference harness). The sidebar deliberately contains only **Loops**, the Loops
views required to create and inspect them (for example Runs and Templates), and
**Settings**. It does not reproduce Linear's tracker navigation or Linear's Settings.

Write a loop (trigger plus prompt), publish it, and our engine fires it on schedule or
on Linear events. Runs stream in the Loops UI exactly as in Linear; reads and
write-back use the connected account's public Linear API.

## Method (why this rebuild is different)

Our method is exact reproduction, not clean-room approximation: we decompile the
real app, read it directly, and reproduce its behavior, structure, and values
exactly, writing our own original code. Every claim is verified against the
decompile:

1. `pipeline/` downloads each Linear release and decompiles it locally into
   `pipeline/corpus/` (gitignored, never committed: legal line). The pipeline is a
   script that runs, not a runbook you read.
2. Facts extracted from the corpus, plus Linear's official API/docs, live in
   `KNOWLEDGE.md` and `extracts/`.
3. `docs/feature-matrix.md` enumerates every Loops feature from that evidence.
   The matrix is the acceptance bar.
4. UI and behavior in the deliberately narrow Loops product are implemented to match
   the corpus exactly, and every applicable row of the matrix is checked against it.

## Status

REBUILD ERA (2026-09-27). The first implementation (M0-M5, ~26k LOC, tests green)
was archived because it was built to a plausible bar without the corpus. It is
preserved at tag `archive/v0-swarm-era`. Roadmap: `PLAN.md`. Board: `STATUS.md`.

## Repo map

| Path | What |
|---|---|
| `AGENTS.md` | the whole operator manual (`CLAUDE.md` points here) |
| `PLAN.md` | milestones |
| `STATUS.md` | the board: what is done, what is now, what is next |
| `KNOWLEDGE.md` | decompile-derived facts about Loops internals |
| `SPECS/` | product specs written from that knowledge; start with `product-contract.md` for scope |
| `extracts/` | vendored public facts (Linear's MIT schema/SDK digest) plus corpus extracts |
| `pipeline/` | the decompile harness; its `corpus/` dir is local only, gitignored |
| `docs/` | feature matrix and deep dives |
| `archive/` | history (swarm-era docs; code lives at tag `archive/v0-swarm-era`) |
| `ci/` | the gates: `bash ci/check-src.sh` (code) · `bash ci/check-ui.sh` (UI parity) |
| `tools/parity/` | the UI parity harness (Rust CLI; SPECS/ui-parity.md) — computes that our UI is the same UI |

Working here: read `AGENTS.md`.
