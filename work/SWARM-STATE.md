# SWARM-STATE — living swarm snapshot

Maintained by the lead; every session freshens its own row (via its task issue) at the
end of each work block. This file + work/EPOCHS.md + work/handoffs/* are what the next
generation reads FIRST — but the **hub body (#59) is the live truth** when they differ.

- generation: **4** (gen-3 died 2026-09-27 ~02:00 UTC — account credits, mid-landing,
  zero code lost)
- protocol: **v4** = browser-less landing. Commits: the land-bot (`/land` comments →
  `.github/workflows/land.yml`). Merges: `github.merge_pull_request` after buddy review.
  Canonical state: hub #59 body + issue bodies (MCP comment paging is broken past
  page 1 — use unauthenticated `curl` on api.github.com for threads).
- repo visibility: **public** (user decision 2026-09-26). No-Linear-proprietary-material
  rule is legally load-bearing.
- branch protection: ruleset **main-pr-only** ACTIVE (2026-09-27, agent-01@gen4,
  user-directed) — `main` requires a PR (0 approvals), force-pushes + deletions
  blocked. Everyone — bot, lead, any PAT — lands via PR. No exceptions.
- backlog: **ENTIRE verified queue landed + merged 2026-09-27** (PRs #47–#69,
  237/237 fresh-clone). Focus is now M5 end-to-end + T-304/T-102 + golden goose.
- GitHub connection: **workspace-public** (conn_01a0e089-c248, user-directed) —
  `provider_unavailable` class dead; playbook stays for Project grants.
- Actions: billing-locked (ticket **#4797514**, user has no card — support must
  remove the dead payment method + lift the lock). Land-bot ready; smoke test #60
  re-fires on unlock. Until then: lead break-glass-lands FILE blocks.
- lead: **agent-01@gen4** (sess_01a0e088-c660-759e-a222-9dcebd33236f) — user-designated.

## Canonical threads

| thread | what |
|---|---|
| issue #59 | **gen-4 swarm hub — canonical state, roster, landing board** |
| issue #1 | Roster (write-only registration log, all generations) |
| issue #2 | Questions & blockers |
| issue #21 | gen-3 hub (tombstoned — archeology) |
| issue #14 | Golden goose: Linear Agent Sessions API as our brain (user-mandated) |
| issue #20 | UI fidelity bar: exact Linear Loops UI parity |

## Task board

Live board: work/STATUS.md. The whole M1–M4 codebase exists as verified FILE blocks +
3 open PRs; gen-4's first sweep = merge #51/#49/#47, then the `/land` queue in
dependency order, then M5 end-to-end.

## Transports

- Repo + issues = durable brain. Sandboxes and `/cloud/files` trees die at reset —
  gen-1/gen-2 lost code that way, gen-3 didn't (FILE blocks held).
- Worker MCP reality (v4-verified): read repo, create/edit issues + comments, create +
  merge PRs on existing branches. Commits: land-bot ONLY. Browser/PAT: lead break-glass
  ONLY (LEAD.md).
- Comment paging bug: canonical state lives in ISSUE BODIES; threads via curl.

## Security (standing, absolute)

Credentials never in repo/issues/chat/cloud/transcripts. v4 sessions need none. The
gen-4 bootstrap PAT (lead, browser-minted 2026-09-27) is revoked post-bootstrap.
gen-1 exposure event stands as the warning: rotate after any transit.
