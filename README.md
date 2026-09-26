# linear-loops-decompile

**Mission: rebuild Linear Loops as a self-hosted system — same UI, same behavior, but the AI brain is ours.**

We decompile Linear's production client to learn exactly how Loops work, then reimplement
the whole thing as original code: a loops server (trigger engine + agent runtime + Linear
data plane) and a web UI faithful to Linear's Loops UX. Settings pages let the user connect
their own Linear account **and their own AI inference harness** (OpenRouter, LiteLLM, vLLM,
Ollama, …). UI ↔ server transport uses the T3 Code Connect pattern instead of Linear's sync
protocol.

This repo is the **shared brain for a swarm of ~10 AI sessions** working in parallel. Every
session starts fresh (no memory, no files) — everything needed is here.

## Start here

1. **Every session:** read [`BOOTSTRAP.md`](BOOTSTRAP.md) → [`COORDINATION.md`](COORDINATION.md) → [`work/STATUS.md`](work/STATUS.md) → claim work per [`ROLES.md`](ROLES.md).
2. **Domain knowledge** (verified by decompiling Linear 1.32.4 on 2026-09-26): [`KNOWLEDGE.md`](KNOWLEDGE.md) — read the sections your role touches. Treat it as ground truth.
3. **Reproducing the decompile corpus** (required — no Linear code lives in this repo): [`RUNBOOK-decompile.md`](RUNBOOK-decompile.md) + [`pipeline/`](pipeline/).
4. **What we are building:** [`SPECS/target-architecture.md`](SPECS/target-architecture.md).

## Repo map

| Path | What |
|---|---|
| `BOOTSTRAP.md` | Paste-this prompt for onboarding a fresh session |
| `COORDINATION.md` | The text-file coordination protocol (claims, leases, inbox, log) |
| `ROLES.md` | The 10 roles and their scopes/deliverables |
| `PLAN.md` | Master plan, milestones, task breakdown |
| `KNOWLEDGE.md` | Everything verified by decompiling Linear (the brain dump) |
| `RUNBOOK-decompile.md` | Exact commands to redownload + decompile Linear from scratch |
| `SPECS/` | Domain specs: loops, agent, sync-protocol, t3-connect, target architecture |
| `extracts/` | Factual interface data pulled from the bundle (models, GraphQL ops, config) |
| `pipeline/` | The decompile scripts (download, extract, crawl, prettify, analyze) |
| `work/` | Shared coordination state: STATUS.md, LOG.md, ROSTER.md, claims/, inbox/ |
| `src/` | (created by the swarm) The actual reimplementation code |

## Ground rules

- **Never commit Linear's proprietary code** (the prettified bundle, DMG contents, asar).
  It is regenerated locally per the runbook and stays local. Extracts in `extracts/` are
  factual interface references (field names, operation names, endpoints) — fine.
- **All reimplementation code must be original.** We study Linear's behavior and reproduce
  it; we do not transliterate their source. Comment *what* it does, not *how their code looks*.
- **Keep this repo private.** Decompilation for interoperability/personal research; do not
  distribute Linear-derived material publicly.
- Coordinate only through the repo text files + GitHub issues. No side channels.
- Small, frequent updates to `work/STATUS.md` and `work/LOG.md` beat big silent pushes.
