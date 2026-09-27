# linear-loops-decompile

Self-hosted Linear Loops: the EXACT same Linear Loops UI and behavior, taken out of
Linear and run on your own server with your own Linear account. Not a lookalike, not
a feature-by-feature approximation: the same product, verified against the decompiled
app itself.

## The brain: the golden goose first

Linear's loop chat and its normal AI chat are the same substrate, but loops are
credit-metered. The golden goose (issue #14) is the normal AI chat route the
first-party app itself uses: we trace it out of the decompiled app and drive it with
your own Linear account, so loops get the Linear-grade brain without loop credits.
Proving that route is the main event of this project.

Until the goose is proven, the server also accepts external inference harnesses
(OpenRouter, LiteLLM, vLLM, Ollama) so loops can run end to end on a brain you own.
These are the fallback, not the goal.

The public Agent Sessions API is a separate, credit-bearing surface for external
agents. We use it for presenter and write-back integration only, never as the brain.

## How it works

Open our web page (served by our server), connect Linear and an inference path in
Settings, write a loop (trigger plus prompt), publish. Our engine fires it on
schedule or on Linear events, the run streams to the UI exactly as in Linear, and
output writes back to Linear through its API.

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
4. UI and behavior are implemented to match the corpus exactly, and every row of
   the matrix is checked against it.

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
| `SPECS/` | product specs written from that knowledge |
| `extracts/` | vendored public facts (Linear's MIT schema/SDK digest) plus corpus extracts |
| `pipeline/` | the decompile harness; its `corpus/` dir is local only, gitignored |
| `docs/` | feature matrix and deep dives |
| `archive/` | history (swarm-era docs; code lives at tag `archive/v0-swarm-era`) |
| `ci/` | the gates: `bash ci/check-src.sh` (code) · `bash ci/check-ui.sh` (UI parity) |
| `tools/parity/` | the UI parity harness (Rust CLI; SPECS/ui-parity.md) — computes that our UI is the same UI |

Working here: read `AGENTS.md`.
