# SWARM-STATE — living swarm snapshot

Maintained by the lead; every session freshens its own row at the end of each work block.
This file + work/EPOCHS.md + work/handoffs/* are what the next generation reads FIRST.

- generation: **2** (gen-1 died 2026-09-26 ~23:0x UTC — account credits)
- protocol: **v3** = v2 (issues = English, code = reviewed PRs, claims as roster
  comments on #1) + Runner-native pager + designation stability (COORDINATION.md §8.5). Hub issue body is canonical when comments overflow —
  the MCP comment pager can't page past the oldest 20 (known tooling bug).
- repo visibility: made **public by the user 2026-09-26** (was private). The
  no-Linear-proprietary-code rule is unchanged and absolute.

## Canonical threads

| thread | what |
|---|---|
| issue #1 | Roster — every incarnation registers here |
| issue #2 | Questions & blockers (cross-session help) |
| issue #21 | Swarm hub — canonical roster, protocols, landing queue |
| issue #14 | Golden goose: Linear Agent/chat as our loop brain (Track A primary — user-mandated: prove it) |
| issue #20 | UI fidelity bar: exact Linear Loops UI parity |

## Slots (gen-2)

See work/EPOCHS.md for the full gen-2 table and gen-1 history. Lead: **agent-01@gen2 (R10)** — user-designated browser session (final ruling 2026-09-26; see EPOCHS.md note).

## Task board deltas vs work/STATUS.md

- T-1101 (proposed by agent-03@gen1): `src/server` skeleton — http+ws server, node:sqlite
  persistence (loops, runs, snapshots, settings secrets, audit events, idempotency, usage
  counters), wiring seams for engine/runtime/connect. Row needs lead commit; owner:
  agent-03@gen2 if they want it.

## Landing queue (lead, in order)

1. Reset/continuity docs (this batch) — FIRST, commit `docs: reset/continuity/lead docs (gen-1 drafts; consolidated agent-01@gen2)`.
2. T-201 `src/model` — extracted from #24 comments, ready in the courier tree (agent-01@gen1).
3. T-301 v2 + T-302 `src/dataplane` — extracted from #26 comments, latest-wins on duplicate paths (agent-08@gen1 + reviewer agent-10@gen1).
4. T-601 + T-602 `src/inference` — extracted from #27 bundle, which supersedes #25 (agent-06@gen1).
Each code package lands on its own branch (`agent-NN/tNNN-slug`), then the author-role's gen-2 owner opens the PR per protocol v2.

## Rebuild list (gen-1 artifacts lost with the old account's cloud — designs settled in issue text, rebuild don't re-litigate)

- T-401 (hub comment by agent-02@gen1, 22:50Z) · T-501 + T-502 (hub, agent-03@gen1,
  22:55Z/23:00Z + review on #28) · T-202 (hub 23:06Z) · T-701 (hub 23:01Z + roster
  heartbeat 23:19Z) · T-901+T-902 (hub 22:40Z/22:56Z + agent-04@gen1's review 23:15Z) ·
  agent-04@gen1's T-101 pipeline/README + extracts (trigger/schedule summary survives on
  hub, 23:12Z) · template-library mining notes (hub 23:06Z).

## Transports

- Repo + issues = durable brain. Cloud `/cloud/files` trees are per-account couriers ONLY —
  gen-1's `patches/` + `linear-loops-swarm/` trees are dead with the old account.
- Worker MCP reality (gen-1 verified): read repo, create issues/comments, open+merge PRs on
  EXISTING branches, edit issue bodies. Cannot create branches/commits — that's the lead.
- Comment paging bug: list_issue_comments returns only the oldest page reliably; long
  threads keep their canonical state in the ISSUE BODY (lead maintains).

## Security (standing, absolute)

Credentials never in repo/issues/chat/cloud. Only the lead signs into GitHub (credential
card + Gmail-MCP 2FA). gen-1 exposure event 2026-09-26: a login transited ~10 gen-1
transcripts — user rotates the password after the lead is in.

