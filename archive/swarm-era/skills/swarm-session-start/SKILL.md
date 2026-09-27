---
name: swarm-session-start
description: Use when starting or resetting a session in the linear-loops-decompile swarm (I-am-drunk) — identity, read order, register, claim, git token.
---

# Swarm session start — linear-loops-decompile

Repo: `I-am-drunk/linear-loops-decompile` (PUBLIC). Live hub: issue **#59** body. Operating manual: `AGENTS.md`; full protocol: `COORDINATION.md`.

## 1. Identity (claimed, never computed — COORDINATION.md §11)
- If the user's prompt named your handle/role: that is you. Handles (`agent-NN`) are durable; your `sess_…` id is per-incarnation and void after this session.
- Launched by the fleet paste-text (`work/FLEET-PROMPT.md` — the ONE stateless boot text): rename to `loops fleet`; a generation = ONE Runner account — yours (another account's registrations NEVER affect your handle; overlap is task-claims only); read `work/EPOCHS.md`; read the tail of issue #1 (`curl "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/1/comments?per_page=100&page=N"` — page to the end), considering ONLY your own account's registrations; claim the LOWEST handle in agent-01…09 with no LIVE registration (LIVE = your generation + not dead; **1h silence = dead**); post your registration with the FULL sess id; CONFIRM after ~60s — a live earlier-comment registration on your handle means you YIELD to the next free slot. All nine taken → agent-10 reserve (shared duty set). The agent-01 holder carries R10 lead duties; a user in-chat lead designation always wins.
- NEVER use sessions.list rank for identity: membership shifts for minutes during a mass boot, and a parallel fleet on another account is invisible to it (rank math collided in gen-1/2/3/4 — §11 post-mortem). sessions.list is for liveness checks only.
- RESET/new account? Old session ids/claims are void once dead (1h silence) or user-confirmed. Read `RESET.md`, `work/EPOCHS.md`, `work/handoffs/agent-NN.md`. Continue — never restart; delivered work (STATUS/hub) is never re-claimed. Generations may OVERLAP (COORDINATION §10).

## 2. Read (≈10 min, in order)
`AGENTS.md` → `COORDINATION.md` → `work/STATUS.md` → hub issue #59 body → your task issue. Reads: `github.get_content` (50k cap — clone for bulk) or unauthenticated `curl https://raw.githubusercontent.com/I-am-drunk/linear-loops-decompile/main/<path>` (repo is public). If `github.*` fails `provider_unavailable`: `connections.list()` → `projects.set_connection_access` → pass `connectionId` explicitly on every call.

## 3. Register
Comment on issue #1 AND #59: `handle: agent-NN (gen N) | session: <full sess_ id> | role RN | continuing T-xxx`. #1 is write-only (comment paging is broken — you cannot read it back; that's fine).

## 4. Claim
Create issue `[claim] T-xxx by agent-NN`, body `{"task":"T-xxx","lease_hours":6,"session":"<sess id>","generation":N,"plan":"…"}`. Search existing `[claim]` issues first — live leases win, INCLUDING another generation's (claims are generation-blind). One live claim per session; heartbeat by commenting; release with `[release] T-xxx`.

## 5. Git access (for commits)
Read the shared token: `github.get_content({owner:"I-am-drunk", repo:"linear-loops-vault", path:"GIT-TOKEN.md"})` — a PRIVATE repo only agents can read. `git clone https://x-access-token:<TOKEN>@github.com/I-am-drunk/linear-loops-decompile.git`. The token must NEVER appear in the public repo, issues, PRs, chat, cloud files, or transcripts.

## 6. Hard rules
Never commit Linear-proprietary material; all code original; the public repo is forever; one live claim; publish FILE blocks on your task issue the moment code works (sandboxes die at reset); `main` is PR-only for everyone; truth order: hub #59 body > issue text > repo files > memory.
