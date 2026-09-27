# EPOCHS — generation registry

An epoch/generation = one Runner-account lifespan of the swarm. Handles agent-01…10 are
stable role slots; session ids are per-generation and tombstoned at reset. Cross-generation
references: `agent-NN@gen<n>`.

## gen-2 — 2026-09-26, current

Spawned 23:07–23:08 UTC. Deterministic handles (spawn-order rank, proposed by
agent-07@gen2, ratified by the lead): rank = agent number. Role map resumes gen-1's
(01→R2, 02→R4, 03→R5, 04→R1, 05→R7, 06→R6, 07→R8, 08→R3, 09→R9, 10→reserve/R10), EXCEPT:
the user designated the browser/Integrator session; after a brief double
  designation (rank-1 ⇄ rank-7) the user ruled finally: **agent-01@gen2 holds R10**.
  PROTOCOL v3 §8.5 makes the next designation change orderly.

| handle | session (full id) | role | status |
|---|---|---|---|
| agent-01 | sess_01a0dff7-e039-7187-b222-b07fdee12282 | **R10 Integrator** (user-designated, final ruling) | active — landed reset docs + recovery package |
| agent-02 | sess_01a0dff8-ebf5-7110-85ed-486caf629366 | R4 | spawned |
| agent-03 | sess_01a0dff9-3ceb-7539-a3f8-e916967afd6a | R5 | spawned |
| agent-04 | sess_01a0dff9-4d4d-7379-be12-12e93e7e09d0 | R1 | spawned |
| agent-05 | sess_01a0dff9-970f-767f-b779-559704830a25 | R7 | spawned |
| agent-06 | sess_01a0dff9-a492-73ca-a8bc-a9a8ed4a8b11 | R6 | spawned |
| agent-07 | sess_01a0dff9-bd76-7753-a2bf-8da5d4a1d367 | R8 | registered on #1 (23:19Z); T-801 delivered |
| agent-08 | sess_01a0dff9-d36c-7150-acd9-8f8478ac0a1c | R3 | spawned |
| agent-09 | sess_01a0dff9-dfe0-77f8-8ee9-c0712f04e9ef | R9 | spawned |
| agent-10 | sess_01a0dffa-008f-748c-8d6e-0520cec94557 | reserve | spawned |

Replacement policy: a slot silent >2h after spawn is presumed dead-on-arrival; the lead
notes it here and the user spawns a replacement (or the lead reassigns the slot's task).

## gen-1 — 2026-09-26, DEAD (account credits exhausted ~23:0x UTC)

All gen-1 session ids (sess_01a0dfb8-*, sess_01a0dfb9-*, sess_01a0dfbb-*) are VOID —
never reference them as live. Historical roster (final state at death):

| handle | role | final state (2026-09-26 ~23:20 UTC) |
|---|---|---|
| agent-01@gen1 | R2 (later +R7) | T-201 [ready] on #24 · T-701 [ready] (cloud artifact lost) |
| agent-02@gen1 | R4 | T-401 [ready] (cloud artifact lost) · EPOCHS + LEAD docs staged |
| agent-03@gen1 | R5 | T-501, T-502, T-202 all [ready] (cloud artifacts lost) · proposed T-1101 |
| agent-04@gen1 | R1 | T-101 report on #30 · extracts + reset docs (cloud lost) |
| agent-05@gen1 | R4→R7→R2 | RESET/LEAD/SWARM-STATE drafts · T-202 claimed |
| agent-06@gen1 | R6 | T-601 [ready] on #25 · T-601+T-602 bundle on #27 |
| agent-07@gen1 | R8 | T-801 page-map in flight · docs-reset-v2.1 (cloud lost) |
| agent-08@gen1 | R3 | T-301 v2 + T-302 done, staged on #26 comments · RESET.md draft |
| agent-09@gen1 | R9 | T-901 + T-902 [ready] (cloud artifact lost; reviews on hub) |
| agent-10@gen1 | reserve | (the …6255f6 session; never re-confirmed) |

