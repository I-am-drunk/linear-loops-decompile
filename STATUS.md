# STATUS

Updated in the same PR as the work it describes.

**Phase: first surfaces, 2026-10-05.** Five product slices exist as PRs —
settings shell + five row patterns, automations list, Inference section,
automation detail frame, provider registry. Before them, zero routes
rendered.

Open scope question: the automations page was to be re-based on **Cursor's
layout**. It is not — AU1/AU2 are built from the plan, the open MCP
specification and our own corpus. Recorded as owner **decision 10** (#339)
rather than left implicit.

## Lanes

| Lane | Next slice | State |
|---|---|---|
| ST settings | ST6 chrome (Workspace/Account/Automations) | ST1–ST5 #337 #340 #347 #348 open |
| AU automations | the runner (fires triggers, runs chains, writes runs) | AU1–AU7 #338 #341 #346 #350 #352 #355 #356 open |
| IN inference | IN3 Anthropic · IN4 T3 Code Connect | IN1 #336, IN2 #343 open |
| IG integrations | IG2 Linear sign-in | IG1 #344 open |
| MCP mcp | MCP2 client (stdio + Streamable HTTP) | MCP1 #345 open |
| SH shell | — | the settings shell (#337) renders standalone |

**ST4, ST5, AU3 and AU4 are assembly** over the five row patterns (#337) and
the section registry (#341). IN2 is the highest-value non-UI row: one key
makes the whole inference lane testable end to end.

## Open PRs

| PR | What | State |
|---|---|---|
| #327 | UI exactness gate + doctrine | reviewed; author recused |
| #322 | gate hole, found first | superseded by #327; author's call |
| #334 | ui-theme digest fix | **this is what makes `ci/check-src.sh` exit 0 on Node 24** |
| #337 → #338 → #340 → #341 | the UI stack: settings shell, automations list, Inference section, detail frame | 69 tests, both gates green |
| #336 | IN1 provider registry | #340 merges it in |
| #328 #335 #339 | IG7 plan slice, prompt sections, decision 10 | docs only |

**First merge in a day: #334 landed 2026-10-05 14:21Z**, so `ci/check-src.sh`
now exits 0 on Node 24 from `main`. Sixteen PRs remain green and mergeable.
**#307 merged 2026-10-05 15:34Z** after six days blocked. The bottleneck is
still merges, not authorship; #327 needs a session that authored it not.

## What exists

Server: transport (`src/connect`), boot + static + store + audit
(`src/server`), settings RPCs, Linear GraphQL client with a header-driven rate
budget. Model layer (`src/model`). Theme (`src/ui-theme`, token-generated).
~16 presentation kernels under `src/ui-*`. Analysis harness (`pipeline/`,
`tools/`).

**UI, on branches** (`src/ui-settings`, `src/ui-settings-inference`,
`src/ui-automations`): settings shell with nav and five row patterns, the
automations list, the Inference section, the detail frame's section registry.
69 tests. Every dimension read from the corpus and cited — 48 facts across
two `ui-facts.json` files.

Nothing renders from `main` yet, because nothing has merged.

## History

`docs/LEARNINGS.md` — three eras, 121 issues and 300+ thread comments
distilled. Read it before proposing a process change; most have been tried.
