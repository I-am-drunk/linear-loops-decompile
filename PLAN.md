# Delivery plan

Build a working automation first, then expand to the whole Linear UI.
SPECS/target-architecture.md defines ownership; docs/plan/surfaces.md defines breadth.

| Lane | Issue | Responsibility |
|---|---|---|
| SH | #314 | Shell, shared UI, evidence gate, workspace surfaces |
| ST | #315 | Linear settings UI and preferences |
| IN | #316 | Provider registry, API/local adapters, verified T3 bridge |
| IG | #317 | Integration ports, Linear auth, reads/events/actions |
| AU | #318 | Cursor automation layout and execution |
| MCP | #319 | Per-automation tools and invocation policy |

Use `node tools/board/main.mjs --feedback` for live PRs and dependencies.
Claims go on these existing lane issues. The old mega-threads are archived.

| Milestone | User-visible acceptance | Required work |
|---|---|---|
| M0 assemble | Open a served shell and settings; save a preference and reload | Land/fix existing SH/ST/IN stacks, then SH4 composition |
| M1 run | Create, save and manually run an automation; see streamed output and cancellation | AU8 application/store boundary, AU9 executor, AU10 UI wiring |
| M2 automate | Scheduled run survives restart; per-automation tools enforce approval | AU11 durable scheduler, MCP2–MCP5, AU5 wiring |
| M3 connect | Pair T3 and run a real turn; sign into Linear and perform an audited action | IN4 interoperability, IG2–IG6 application wiring |
| M4 expand | Each next Linear workspace surface meets its recorded reference states | UI slices in docs/plan/surfaces.md |

T3 remains a first-class provider. Its unverified protocol is a distinct
acceptance task, not a reason to block independent API/local-provider work.

## Landing order

1. Resolve and land the UI gate chain, including #374, before calling UI facts enforced.
2. Land independent roots before dependents. Keep existing branches and credit;
   a passing package test does not make a stacked PR independently mergeable.
3. Wire one vertical flow through server, storage and UI. The missing runtime
   slices are specified in docs/plan/delivery.md.
4. Expand by surface and state. Reuse verified primitives; do not rebuild a shell
   or reset coordination in every session.

## Open defects

Keep #329 (rotating corpus), #365 (credential transport), #368 (numeric input)
and #370 (unenforced security boundaries) visible until fixed and verified.
The live board owns status; docs/LEARNINGS.md explains recurring failure modes.

Per-lane details: docs/plan/settings.md, inference.md, integrations.md,
automations.md and mcp.md. These are implementation plans; the product scope
and settled decisions in docs/plan/decisions.md take precedence over old era docs.
