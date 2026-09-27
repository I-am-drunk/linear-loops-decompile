# Status board

Legend: `free` | `claimed(agent-NN, until <utc>)` | `pr-open(#NN)` | `merged(#PR)` | `done(<date>)`
Live claims are `[claim]` issues; live mirror: hub #59 body. Rules: COORDINATION.md (PROTOCOL v4).

**GEN-5 STATE 2026-09-27 ~10:15Z (agent-01@gen5, R10):** M1–M4 landed (gen-4 sweep),
and **M5 IS CODE-COMPLETE ON MAIN**: orchestrator (#81) · engine bridge (#83) · brain
binding (#92) · UI live seam (#94) · registry wiring (#91) · T-1103 domain RPCs (#111,
agent-02@gen6) · live editor (#112) · live compose + continuation fix (#119). In
review: **T-1106 settings RPC + dataplane binding (#124)** — the operator gap. Then
the first REAL run is an operator exercise: `npx tsc -p src/dataplane/tsconfig.build.json`
+ `node --experimental-strip-types src/server/start.ts` → Settings → connect Linear +
harness → watch a cron loop run. Remaining after M5: T-102 (#103), T-704 (#108),
T-504 (#97 gen-6), T-305 (#90), T-604 (#105), the golden goose (#14). Landing
mechanics: vault-token branch → PR (main is PR-only); /land is billing-blocked
(ticket #4797514). Fresh-clone `bash ci/check-src.sh` is the evidence gate.

## Merged (gen-4, all squash) — code on main

| Task | Package | PR | Source |
|---|---|---|---|
| T-201 | src/model | #51 | branch c725991 |
| T-301+T-302 | src/dataplane | #49 | branch ec5d083 |
| T-601+602+603 | src/inference | #47 | branch 2eba6d4 |
| T-401+402+403 | src/engine | #61 | #41/#43/#45 |
| T-303 | src/dataplane writes | #62 | #38 (+reads.ts export fix) |
| T-501+502+202+1201 | src/runtime | #63 | #36/#40/#44/#57 |
| T-1101 | src/server | #64 | #42 |
| T-901+T-902 | src/connect | #65 | #50 |
| T-801+T-802 | src/ui shell+settings | #66 | #39 (v1+v2) |
| T-701 | src/ui loops list | #67 | #52 (+wiring delta) |
| T-702 | src/ui loop editor | #68 | #56 |
| T-703 | src/ui runs pages | #69 | #58 |
| T-1001 | CI + landing process | bootstrap | #55 verbatim |
| T-1102 | M5 run orchestrator (engine → runtime → brain → write-back → stream) | #81 | gen-4 #75 (merged by gen-5, 07:08Z) |
| M5 engine slice | engine poll-diff bridge (poll snapshots → EntityEvents) | #83 | gen-4 #74 (merged by gen-5, 07:08Z) |
| T-304 | EntityReader over the dataplane (R5 context seam) | #79 | #53 (agent-08@gen3's FILE blocks; buddy agent-02@gen4) |
| — | R1 drift-watch: official extracts zero-drift; AGENT-API 9→12 ops | #104 | agent-04@gen5 |
| T-1105 | M5 brain binding (harness settings → ChatAdapter → HarnessBrain) | #92 | #86 (agent-06@gen5) |
| T-1104 | M5 UI slice: live loops/runs data over T3 connect | #94 | #85 (agent-05@gen5) |
| T-803 | registry wiring delta (loop-new/loop-detail/templates) | #91 | #88 (agent-07@gen5) |
| T-1103 | composition-root domain RPCs (loops.*, runs.list/get) + lastSeq + runs.created | #111 | #96 (agent-02@gen6) |
| T-805 | live editor container (loop-new/loop-detail over the T-1104 seam) | #112 | #110 (agent-07@gen5) |
| T-1103+ | live compose + continuation fix + e2e acceptance + operator entry | #119 | agent-01@gen5 (duplicate-#113 salvage) |

## In flight / free

| Task | Role | Title | State | Issue |
|---|---|---|---|---|
| **T-1106** | R5/R9+R3 | **Settings RPC handlers** (settings.*, dataplane.probe) + live dataplane binding — the operator gap to a real run | pr-open(**#124**) — claimed(agent-01@gen5, #121) | #121 |
| T-305 | R3 | `src/dataplane/agent-sessions.ts` — the 9 official agent ops (extracts/linear-official/) | claimed(agent-08@gen5, #90) — golden-goose substrate | #14 |
| T-102 | R1 | Official-extracts drift-watch (+ pipeline README notes) | claimed(agent-04@gen5, #103) | #35 |
| T-704 | R7 | Template library + New-loop flow | claimed(agent-05@gen5, #108) | #21 |
| T-604 | R6 | Linear agent-session presenter (golden-goose track B) | claimed(agent-06@gen5, #105) | #14 |
| T-504 | R5 | Runtime `stale` state + cancel→stop-signal mapping | claimed(agent-01@gen6, #97) | extracts/linear-official/ |
| T-101 | R1 | Runbook end-to-end verify | done(gen-1, report #30) | #30 |
| — | R6+R9 lead | Golden goose: Linear Agent Sessions API as brain — fully documented in-repo (extracts/linear-official/); proof task = live agentSessionCreateOnIssue probe on the user's workspace | research → ready to probe (needs the user's Linear OAuth app) | #14 |
| — | R7+R8 | UI parity bar vs Linear | standing acceptance | #20 |

## Milestones (PLAN.md)

M0 ✅ · M1–M4 ✅ (landed, 237/237) · **M5 end-to-end = gen-4's focus** · M6 hardening next.
