# linear-loops-decompile

**Mission: rebuild Linear Loops as a self-hosted system — same UI, same behavior, but
the AI brain is ours.**

We decompile Linear's production client to learn exactly how Loops work, then
reimplement the whole thing as original code: a loops server (trigger engine + agent
runtime + Linear data plane) and a web UI faithful to Linear's Loops UX. Settings pages
let the user connect their own Linear account **and their own AI inference harness**
(OpenRouter, LiteLLM, vLLM, Ollama, …). UI ↔ server transport uses the T3 Code Connect
pattern instead of Linear's sync protocol.

> **Product vision (user, 2026-09-26):** We love Linear and Loops. The goal is the
> *exact same UI* as Linear's Loops — the user opens OUR self-hosted web page in a
> browser and it looks and behaves like opening Linear. The sidebar carries the same
> Loops features. It works against the user's REAL Linear account (they log in /
> connect it), and we speak to the same kinds of endpoints Linear's AI features use.
> Linear does not expose their brain via public APIs — that is why the default brain is
> the user's own inference (OpenRouter/vLLM/…), and why the "golden goose" research
> track (using Linear's chat surface as the brain, issue #14) matters. Linear's sync
> protocol is genuinely complex — SPECS/sync-protocol.md documents what we deliberately
> do NOT rebuild; think hard before deviating from the T3-connect plan.

This repo is the **shared brain for a swarm of ~10 AI sessions** working in parallel.
Every session starts fresh (no memory, no files) — everything needed is here.

## Start here

1. **Every session:** [`BOOTSTRAP.md`](BOOTSTRAP.md) — it IS the onboarding prompt and
   contains the tooling playbook — then [`COORDINATION.md`](COORDINATION.md) →
   [`work/STATUS.md`](work/STATUS.md) → the current hub issue body (#59, gen-4).
   If the prompt says **RESET**: [`RESET.md`](RESET.md) too (you are a successor
   incarnation — resume, don't restart). The lead (R10) reads [`LEAD.md`](LEAD.md).
2. **Domain knowledge** (verified by decompiling Linear 1.32.4 on 2026-09-26):
   [`KNOWLEDGE.md`](KNOWLEDGE.md) — read the sections your role touches. Ground truth.
3. **Reproducing the decompile corpus** (required — no Linear code lives in this repo):
   [`RUNBOOK-decompile.md`](RUNBOOK-decompile.md) + [`pipeline/`](pipeline/).
4. **What we are building:** [`SPECS/target-architecture.md`](SPECS/target-architecture.md).

## Repo map

| Path | What |
|---|---|
| `AGENTS.md` / `CLAUDE.md` | **The operating manual every AI session reads first** |
| `BOOTSTRAP.md` | Paste-this prompt for onboarding a fresh session (with the MCP playbook) |
| `COORDINATION.md` | **PROTOCOL v4** — claims, FILE blocks, `/land`, reviews, merges, hub |
| `RESET.md` | Reset/resurrection protocol — how a new generation resumes |
| `LEAD.md` | The Integrator (R10): duties + the break-glass browser procedure |
| `ROLES.md` | The 10 roles and their scopes/deliverables |
| `PLAN.md` | Master plan, milestones, task breakdown |
| `KNOWLEDGE.md` | Everything verified by decompiling Linear (the brain dump) |
| `RUNBOOK-decompile.md` | Exact commands to redownload + decompile Linear from scratch |
| `SPECS/` | Domain specs: loops, agent, sync-protocol, t3-connect, target architecture |
| `extracts/` | Factual interface data pulled from the bundle (models, GraphQL ops, config) |
| `pipeline/` | The decompile scripts (download, extract, crawl, prettify, analyze) |
| `work/` | Shared coordination state: STATUS.md, LOG.md, ROSTER.md, SWARM-STATE.md, EPOCHS.md, LANDING.md, handoffs/ |
| `.github/workflows/typecheck.yml` + `ci/check-src.sh` | CI: per-package typecheck + tests (T-1001) |
| `.github/workflows/land.yml` + `.github/swarm/land.mjs` | **The land-bot** — FILE-block comments → branch commits + PRs (PROTOCOL v4) |
| `src/` | (created by the swarm) The actual reimplementation code |

## Ground rules

- **Never commit Linear's proprietary code** (the prettified bundle, DMG contents,
  asar). It is regenerated locally per the runbook and stays local. Extracts in
  `extracts/` are factual interface references (field names, operation names,
  endpoints) — fine.
- **All reimplementation code must be original.** We study Linear's behavior and
  reproduce it; we do not transliterate their source. Comment *what* it does, not
  *how their code looks*.
- **Repo visibility is user-controlled** (public since 2026-09-26). The ban on
  Linear-derived material is unchanged and absolute — treat every commit AND every
  issue comment as public forever.
- Coordinate only through the repo text files + GitHub issues. No side channels.
- **Credentials never anywhere** — v4 sessions need none (the land-bot commits; the
  MCP merges). Break-glass browser use: LEAD.md only.
- Small, frequent updates beat big silent pushes. Files win over memory; issue text
  over files; the hub body over everything.
