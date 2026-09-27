# EPOCHS — generation registry

An epoch/generation = one Runner-account lifespan of the swarm. Handles agent-01…10 are
stable role slots; session ids are per-generation and tombstoned at reset.
Cross-generation references: `agent-NN@gen<n>`. Generations may OVERLAP (v4.3,
COORDINATION.md §10): a new account's fleet booting before the old one dies is
normal — concurrent rows below note their overlap window.

## gen-5 — 2026-09-27, current

Boot 06:07Z on a NEW Runner account (user: "I only have 5 sessions running"). v4.5
(user-directed): a generation = ONE Runner account — the two fleets that both wrote
"gen 4" on #1 (02:36Z + 05:06Z boots, other account) are gen-4; THIS account is
gen-5. Identity per COORDINATION §11: claimed lowest-free, comment-id tie-break,
confirm-and-yield; registrations from other accounts never affect slots.

| handle | session (full id) | role | status |
|---|---|---|---|
| agent-01 | sess_01a0e17b-855f-7481-8648-84066a73a21c | R10 lead | holds (07:07:17Z; yielded agent-05 per §11 — 9882's claim was earlier — and took lowest-free) |
| agent-02…04 | (open — unfilled slots = unclaimed work, not an error) | R4 · R5 · R1 | open |
| agent-05 | sess_01a0e17b-9882-71a3-9398-82676e35ffdf | R7 | holds (registration 06:16:22Z, earliest) |
| agent-06 | sess_01a0e179-5a8c-735f-8106-bef02e3c8ed0 | R6 | holds (06:18:18Z) |
| agent-07 | sess_01a0e17b-5f42-738f-9d26-c0b7102c6ffa | R8 | holds (06:25:51Z) |
| agent-08 | sess_01a0e17b-73cc-7152-9e9d-7397d5dde024 | R3 | holds (06:37:25Z; user-directed v4.4/v4.5 docs) |
| agent-09 | (open) | R9 | open |
| agent-10 | (reserve, shared) | R2/reserve | — |

First-hour notes: the boot collided twice on retired rank math (duplicate agent-05,
06:16–06:26Z — resolved per §11: 9882 holds; duplicate T-1104 claim #87 + PR #95
released/closed, port list to #94) and the 06:07Z title-pool fragment ("gen4 swarm"
vs the durable "loops fleet") slowed confirmations. Lead succession: agent-01@gen5
took the pen 07:1xZ (hub #59 body rewrite, claim sweep #74/#75, this truth pass).


## gen-4 — 2026-09-27, DEAD (account replaced mid-M5; death user-confirmed 06:4xZ)

**Tombstone (written by agent-01@gen5, the living side):** all gen-4 session ids
(sess_01a0e088 / sess_01a0e141 / sess_01a0e142 / sess_01a0e08c + the 05:06Z boot)
VOID. Live claims #74 (M5 engine slice) + #75 (T-1102) void per §10.2 — closed by
the gen-5 claim sweep. **Nothing lost:** the entire M1–M4 backlog landed in the
#47–#73 sweep (237/237 fresh-clone), and gen-4's two M5 PRs were merged by gen-5
with reproduced-evidence reviews: **#81 (T-1102 run orchestrator) + #83 (engine
poll-diff bridge), 2026-09-27 07:08Z.** Its protocol legacy is permanent: v4
(browser-less swarm), v4.2 lean issues, the vault-token commit path, the land-bot,
the main-pr-only ruleset, the linear-official two-source cross-check.

Boot: user designated agent-01@gen4 as Integrator and ordered the docs fix +
browser-less landing BEFORE spawning the other sessions. Protocol v4: the land-bot
commits for everyone. v4.4 (user-directed, 2026-09-27): identity is CLAIMED at boot
per FLEET-PROMPT STEP 0 / COORDINATION §11 (registration-order, comment-id
tie-break) — the launch-prompt rank tables reopened the collision mode (duplicate
agent-05, 06:07Z boot) and are retired with this note.

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
