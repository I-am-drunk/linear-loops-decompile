# SWARM-STATE — living swarm snapshot

Maintained by the lead; every session freshens its own row (via its task issue) at the
end of each work block. This file + work/EPOCHS.md + work/handoffs/* are what the next
generation reads FIRST — but the **hub body (#59) is the live truth** when they differ.

- generation: **5 + 6 CONCURRENT** (gen-4 died 2026-09-27 — account replaced mid-M5,
  user-confirmed; zero code lost: its M5 PRs #81/#83 were merged 07:08Z. gen-6
  booted 07:09Z on a third account — overlap is normal per §10/v4.5; claims compete
  generation-blind, the T-1103 race proved it)
- protocol: **v4.6** = browser-less landing + claimed identity. Identity: COORDINATION
  §11 (register on #1, ~60s confirm, earliest live comment id holds; session title
  `loops fleet`); a generation DERIVES per work/EPOCHS.md §1 (account-anchored — a
  same-account reboot is the NEXT generation); the 1h rule governs handle SLOTS,
  never generation membership. Commits: the
  shared vault token (below); land-bot when Actions unlocks. Merges:
  `github.merge_pull_request` after buddy review with reproduced evidence.
  Canonical state: hub #59 body + issue bodies (MCP comment paging is broken past
  page 1 — use unauthenticated `curl` on api.github.com for threads).
- repo visibility: **public** (user decision 2026-09-26). No-Linear-proprietary-material
  rule is legally load-bearing.
- branch protection: ruleset **main-pr-only** ACTIVE (2026-09-27, agent-01@gen4,
  user-directed) — `main` requires a PR (0 approvals), force-pushes + deletions
  blocked. Everyone — bot, lead, any PAT — lands via PR. No exceptions.
- backlog: **M5 CODE-COMPLETE ON MAIN** (2026-09-27 ~10:05Z): orchestrator #81 ·
  engine bridge #83 · brain binding #92 · UI live seam #94 · registry wiring #91 ·
  domain RPCs #111 · live editor #112 · live compose + continuation fix #119. In
  review: **T-1106 settings RPC + dataplane binding (#124)** — the operator gap;
  then the first REAL run is an operator exercise (start.ts + Settings). After M5:
  T-102 (#103), T-704 (#108), T-504 (#97), T-305 (#90), T-604 (#105), golden goose.
- GitHub connection: **workspace-public** (conn_01a0e089-c248, user-directed) —
  `provider_unavailable` class dead; playbook stays for Project grants.
- shared git token: **private vault repo `I-am-drunk/linear-loops-vault`** (user-directed
  2026-09-27 — public swarm repo + private agent-readable credential store; GitHub
  secrets are write-only so a vault repo is the only pattern that works). Classic
  `repo`-scoped PAT, expires 2026-10-27, rotation = lead duty (vault GIT-TOKEN.md).
  Never in the public repo / issues / chats.
- Skills: repo-local `.agents/skills/{swarm-session-start,swarm-deliver-pr,
  swarm-review,swarm-github-playbook}/SKILL.md` are CANONICAL (curl raw); Runner
  Workflow-Library copies may be absent on a fresh account.
- AGENTS.md + CLAUDE.md at repo root = the session operating manual.
- Actions: billing-locked (ticket **#4797514**, user has no card — support must
  remove the dead payment method + lift the lock). Land-bot ready; smoke test #60
  re-fires on unlock. Until then: lead break-glass-lands FILE blocks.
- lead: **agent-01@gen5** (sess_01a0e17b-855f-7481-8648-84066a73a21c) — via §11
  lowest-free slot (a user in-chat designation always wins; none given for gen-5).
  R10 = pen/sweeps/tie-breaks/PR-audit duty set; break-glass browser jobs (vault
  rotation, `.github/**`) need the user's browser slot — none pending.

## Canonical threads

| thread | what |
|---|---|
| issue #59 | **swarm hub — canonical state, roster, board (gen-5 pen: agent-01@gen5)** |
| issue #1 | Roster (write-only registration log, all generations) |
| issue #2 | Questions & blockers |
| issue #21 | gen-3 hub (tombstoned — archeology) |
| issue #14 | Golden goose: Linear Agent Sessions API as our brain (user-mandated) |
| issue #20 | UI fidelity bar: exact Linear Loops UI parity |

## Task board

Live board: work/STATUS.md. M5's remaining legs are the three open PRs (#91/#92/#94)
plus T-1103 (free, critical path); the full task table with free/claimed states is
mirrored in the hub #59 body.

## Transports

- Repo + issues = durable brain. Sandboxes and `/cloud/files` trees die at reset —
  gen-1/gen-2 lost code that way, gen-3 didn't (FILE blocks held).
- Worker MCP reality (v4-verified): read repo, create/edit issues + comments, create +
  merge PRs on existing branches. Commits: **vault-token git push** (primary, self-serve)
  or the land-bot (blocked by the Actions billing lock). Browser/PAT: lead break-glass
  ONLY (LEAD.md).
- Comment paging bug: canonical state lives in ISSUE BODIES; threads via curl.

## Security (standing, absolute)

Credentials never in repo/issues/chat/cloud/transcripts. v4 sessions need none. The
gen-4 bootstrap PAT (lead, browser-minted 2026-09-27) is revoked post-bootstrap.
gen-1 exposure event stands as the warning: rotate after any transit.
