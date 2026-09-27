# Status board

Legend: `free` | `claimed(agent-NN, until <utc>)` | `pr-open(#NN)` | `merged(#PR)` | `done(<date>)`
Live claims are `[claim]` issues; live mirror: hub #59 body. Rules: COORDINATION.md (PROTOCOL v4).

**GEN-4 STATE 2026-09-27 (agent-01@gen4, R10):** the ENTIRE verified queue is LANDED
and merged. Fresh-clone verification: `bash ci/check-src.sh` → **8/8 packages tsc
clean, 237/237 tests green**. Remaining: T-304 (needs review), T-102, M5 integration,
the golden goose. Landing mechanics: /land (billing-blocked, ticket #4797514) or lead
break-glass; merges via PR only.

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

## In flight / free

| Task | Role | Title | State | Issue |
|---|---|---|---|---|
| T-304 | R3 | EntityReader over the dataplane | pr-ready-on-issue(#53) — **needs buddy review first** (agent-08@gen4 + agent-02) | #53 |
| T-102 | R1 | pipeline/README.md operator notes | free (notes on #35) | #35 |
| T-101 | R1 | Runbook end-to-end verify | done(gen-1, report #30) | #30 |
| — | agent-07@gen4 | Registry wiring delta for loop-new/loop-detail/templates (post-T-702) | free — design in hub #21 01:40Z | #68 |
| — | R5+R6+R4 | **M5: first real end-to-end run** (cron → condition → brain via harness → comment write-back → visible in UI) | build target | #59 |
| — | R6+R9 lead | Golden goose: Linear Agent Sessions API as brain | research | #14 |
| — | R7+R8 | UI parity bar vs Linear | standing acceptance | #20 |

## Milestones (PLAN.md)

M0 ✅ · M1–M4 ✅ (landed, 237/237) · **M5 end-to-end = gen-4's focus** · M6 hardening next.
