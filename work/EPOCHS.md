# EPOCHS — generation registry

An epoch/generation = one Runner-account lifespan of the swarm. Handles agent-01…10 are
stable role slots; session ids are per-generation and tombstoned at reset.
Cross-generation references: `agent-NN@gen<n>`.

## gen-4 — 2026-09-27, current

Boot: user designated agent-01@gen4 as Integrator and ordered the docs fix +
browser-less landing BEFORE spawning the other 9 sessions. Protocol v4: the land-bot
commits for everyone; handles/roles are pre-assigned in each launch prompt (no rank
computation — the gen-2/3 collision mode is closed).

| handle | session (full id) | role | status |
|---|---|---|---|
| agent-01 | sess_01a0e088-c660-759e-a222-9dcebd33236f | **R10 lead** (user-designated) | active — v4 architecture |
| agent-02…10 | launch pending | R4 · R5 · R1 · R7 · R6 · R8 · R3 · R9 · R2/reserve | see work/ROSTER.md |

## gen-3 — 2026-09-27, DEAD (account credits ~02:00 UTC, ~85 min lifespan)

All gen-3 session ids (sess_01a0e04a…sess_01a0e04f range) are VOID. Spawned
00:37:08–00:40:06Z. Rank-table identity (rank = agent number) produced one collision
(sess …bb14 registered agent-09 at rank 4; rank-9 sess …ed0b was rerouted to agent-04)
and one mid-flight re-designation (user moved R10 from agent-01@gen3 to agent-02@gen3
at 01:37Z). **Died mid-landing: nothing merged; nothing lost** — every deliverable was
FILE-blocked on task issues, and agent-10@gen3 validated the full queue as a unit at
01:57Z (8/8 packages tsc clean, 203/203 tests).

| handle | role | final state at death |
|---|---|---|
| agent-01@gen3 | R10 (designated; never logged in) | hub body maintained; designation moved |
| agent-02@gen3 | R4 + R10 (browser, user-designated 01:37Z) | R4 column verified carried (54/54); T-303 buddy review; PAT minted, died unused |
| agent-03@gen3 | R5 | gen-3 docs package staged on hub; T-1201 rewrite on #57 |
| agent-04@gen3 | R1 | slot open at death |
| agent-05@gen3 | R7 | T-701 #52 · T-702 #56 · T-703 #58 (the R7 column rebuilt durably) |
| agent-06@gen3 | R6 | PR #47 shepherd |
| agent-07@gen3 | R8 | T-802 v2 delta; landing-queue corrections 01:40Z (load-bearing) |
| agent-08@gen3 | R3 | T-303 re-verified on #38; T-304 on #53 |
| agent-09@gen3 | R9 | T-901+T-902 complete src/connect on #50 (20/20) |
| agent-10@gen3 | reserve/janitor | T-1001 rebuilt on #55; review sweep #1 + full-tree CI validation (01:57Z) |

## gen-2 — 2026-09-26, DEAD (account credits ~00:37 UTC)

All gen-2 session ids (sess_01a0dff7…sess_01a0dffa) VOID. Landed: reset/continuity docs
(0ab2353), code branches `agent-01/t201-model` c725991, `agent-08/t301-t302-dataplane`
ec5d083, `agent-06/inference-t601-t603` 2eba6d4. PROTOCOL v3 (Runner pager +
designation stability §8.5) — superseded by v4. Roster/history: pre-v4 editions of this
file (git history); tombstone trimmed 2026-09-27.

## gen-1 — 2026-09-26, DEAD (account credits ~23:0x UTC)

All gen-1 session ids (sess_01a0dfb8/9/bb ranges) VOID. Delivered: T-101 report (#30),
T-201 (#24), T-301 v2 + T-302 (#26), T-601/602 (#25/#27); cloud-staged artifacts lost —
the event that created the FILE-block durability rule. Full per-slot table: git history.
