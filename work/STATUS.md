# Status board

Legend: `free` | `claimed(agent-NN, until <utc>)` | `pr-open(#NN)` | `merged(#PR)` | `done(<date>)`
Live claims are `[claim]` issues; live mirror: hub #59 body. Rules: COORDINATION.md (PROTOCOL v4).

**GEN-5 STATE 2026-09-27 (agent-01@gen5, R10):** the ENTIRE verified queue is LANDED
and merged (gen-4 sweep, 237/237), and M5 is mid-flight: the **run orchestrator (#81)
and engine poll-diff bridge (#83) are MERGED (07:08Z)**; brain binding (#92), UI live
seam (#94), and registry wiring (#91) are in buddy review. **T-1103 (composition-root
RPC handlers) is the critical path and FREE to claim** — the UI and orchestrator both
need it. Remaining after M5: T-304 review, T-102, T-704, T-504, the golden goose.
Landing mechanics: vault-token branch → PR (main is PR-only); /land is billing-blocked
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

## In flight / free

| Task | Role | Title | State | Issue |
|---|---|---|---|---|
| **T-1103** | R5/R9 | **Composition-root RPC handlers** (loops.list/get/upsert/publish/setEnabled · runs.list/get) over the T-902 channel, Store-backed, wired into createLoopsServer — **the M5 critical path** | **free** — spec: PR #94 `src/ui/src/live/contract.ts` + METHOD_SCOPES; `runs.get` should return lastSeq | #59 |
| T-1104 | R7 | M5 UI slice: live loops/runs data over T3 connect | pr-open(#94) — claimed(agent-05@gen5, #85) | #85 |
| T-1105 | R6 | M5 brain binding (harness settings → ChatAdapter → HarnessBrain at composition root) | pr-open(#92) — claimed(agent-06@gen5, #86) | #86 |
| T-803 | R8 | Registry wiring delta: loop-new/loop-detail/templates | pr-open(#91) — claimed(agent-07@gen5, #88) | #88 |
| T-305 | R3 | `src/dataplane/agent-sessions.ts` — the 9 official agent ops (extracts/linear-official/) | claimed(agent-08@gen5, #90) — golden-goose substrate | #14 |
| T-304 | R3 | EntityReader over the dataplane | pr-ready-on-issue(#53) — **needs buddy review** (agent-08@gen5 + additive) | #53 |
| T-102 | R1 | pipeline/README.md operator notes | free (notes on #35) | #35 |
| T-704 | R7 | Template library + New-loop flow | free (gen-3 claim void; templates placeholder rides #91) | #21 |
| T-504 | R5 | Runtime `stale` state + cancel→stop-signal mapping (official status enum) | free — cross-check divergence | extracts/linear-official/AGENT-API.md |
| T-101 | R1 | Runbook end-to-end verify | done(gen-1, report #30) | #30 |
| — | R6+R9 lead | Golden goose: Linear Agent Sessions API as brain — fully documented in-repo (extracts/linear-official/); proof task = live agentSessionCreateOnIssue probe on the user's workspace | research → ready to probe (needs the user's Linear OAuth app) | #14 |
| — | R7+R8 | UI parity bar vs Linear | standing acceptance | #20 |

## Milestones (PLAN.md)

M0 ✅ · M1–M4 ✅ (landed, 237/237) · **M5 end-to-end = gen-4's focus** · M6 hardening next.
