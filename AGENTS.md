# AGENTS.md — operating manual for AI sessions

You are one of ~10 AI sessions building **linear-loops-decompile**: a self-hosted
reimplementation of Linear Loops — same UI, same behavior, but the AI brain is the
user's own inference (OpenRouter/vLLM/…). You have no memory; this repo + its issues
are the entire shared brain. Product vision: README.md. Full protocol: COORDINATION.md.

## First five minutes

1. Read this file → `COORDINATION.md` → `work/STATUS.md` → hub issue **#59** body.
2. Launched by the swarm paste-text? It's `work/FLEET-PROMPT.md` (the ONE boot text,
   stateless — any generation, any fleet size) — its STEP 0 claims your handle
   (identity is claimed, never rank-computed: COORDINATION.md §11). If the user named
   your handle/role in-chat: that is you.
3. Skills for this swarm live IN the repo (canonical — read with curl):
   `.agents/skills/{swarm-session-start,swarm-deliver-pr,swarm-review,swarm-github-playbook}/SKILL.md`.
   Runner Workflow-Library copies (load_skill) may not exist on a fresh account.

## The loop

register (issue #1 **and** #59) → claim (`[claim] T-xxx by agent-NN` issue, JSON body,
one live claim) → work → deliver → buddy review → squash merge → note it on #59.

## Commit paths (three, in order of preference)

1. **Git push with the shared vault token** (self-serve, works today):
   read `GIT-TOKEN.md` in the PRIVATE repo `I-am-drunk/linear-loops-vault` via
   `github.get_content` — then `git clone/push` over HTTPS (branch + PR flow below).
2. **The land-bot** — comment `/land branch=agent-NN/tNNN-slug pr="T-xxx: …"` + FILE
   blocks on the task issue; a GitHub Action commits + opens the PR. (Blocked until the
   account's Actions billing lock clears — hub #59's top bullet tracks it.)
3. **Lead break-glass** — LEAD.md; for `.github/**`, settings, emergencies.

`main` is **PR-only for every actor** (ruleset `main-pr-only`: require PR, 0 approvals,
force-push + deletion blocked). No path bypasses review.

## Conventions (CI-enforced)

- Node 22 (≥22.18), TypeScript strict, zero heavy runtime deps (`zod` is the standing
  exception). UI: React 19 + Vite. Behavior parity with Linear Loops (#20).
- Package = `src/<name>/` with its OWN tsconfig; new packages use `.ts`-extension
  imports + type stripping (work/LANDING.md §Conventions).
- The gate: `bash ci/check-src.sh` on a fresh clone — every package, tsc + tests.
- Cross-check before building on Linear behavior: `extracts/linear-official/` (official
  MIT schema/SDK digest — public-API truth) vs `extracts/` + `KNOWLEDGE.md` (decompile
  truth for Loops internals). Rule: COORDINATION.md §9.

## PR contract

- Branch: `agent-NN/tNNN-slug` (or `docs/<slug>`; during generation overlap:
  `gen<N>/agent-NN/tNNN-slug`). One task = one branch = one PR.
- Commit: `T-NNN: <what> (agent-NN)` — credit authors and reviewers.
- PR body: task-issue link · file list · verification evidence (tsc summary, test
  counts, Node version) · review checklist. Template: the `swarm-deliver-pr` skill.
- Merge: squash via `github.merge_pull_request` AFTER one buddy review with reproduced
  evidence. Buddies: R2↔R5, R3↔R4, R6↔R9, R7↔R8, R1↔R10.

## External review agents (bots)

**CodeRabbit** (`coderabbitai` GitHub App, account-wide, free on this public repo)
reviews every PR; its policy is `.coderabbit.yaml` (version-controlled, tuned to OUR
conventions — never another project's). Its `CodeRabbit` check is a required merge
gate; buddy reviews stay required too (judgment ≠ mechanics). Adding another bot:
a one-line entry here first (name, gate, config path); if it can't stay in scope,
it's trimmed or uninstalled (lead's call).

Repo-local skills live at `.agents/skills/*/SKILL.md` (cross-tool Agent Skills
standard; `.claude/skills` symlinks to it). Runner Workflow Library skills mirror them.

## Hard rules (absolute)

- **Never commit Linear-proprietary material** (bundle/DMG/asar/prettified output).
  `extracts/` = facts only. All reimplementation code is original.
- **This repo is PUBLIC.** Credentials NEVER here, nor in issues/PRs/chats/transcripts.
  The shared git token lives ONLY in the private vault.
- Durable = repo + PRs + issue text. Sandboxes and cloud trees die at reset (gen-1/2
  lost code; gen-3 didn't — FILE blocks on task issues are the courier of last resort).
- One live claim; heartbeat it. Truth order: hub #59 body > issue text > repo files >
  your memory (you have none tomorrow).

## State

Live truth: hub issue **#59** body + `work/STATUS.md`. Roster: #1 (write-only) +
`work/ROSTER.md`. Help: #2 · Golden goose: #14 · UI bar: #20 · Lead duties: LEAD.md.
