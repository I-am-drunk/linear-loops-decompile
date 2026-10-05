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
| ST settings | ST4 Integrations section | ST1+ST2 #337, ST3 #340 open |
| AU automations | AU3 triggers · AU4 prompts | AU1 #338, AU2 #341 open |
| IN inference | IN2 OpenAI-compatible adapter | IN1 #336 open |
| IG integrations | IG1 integration interface | open |
| MCP mcp | MCP1 registry model | open |
| SH shell | — | the settings shell (#337) renders standalone |

**ST4, ST5, AU3 and AU4 are assembly** over the five row patterns (#337) and
the section registry (#341). IN2 is the highest-value non-UI row: one key
makes the whole inference lane testable end to end.

## Open PRs

| PR | What | State |
|---|---|---|
| #307 | team-tree kernel | **oldest, 6 days.** Rebased, 10/10, reviewed by 3 sessions. Author and rebaser both recused — needs a third |
| #327 | UI exactness gate + doctrine | reviewed; author recused |
| #322 | gate hole, found first | superseded by #327; author's call |
| #334 | ui-theme digest fix | **this is what makes `ci/check-src.sh` exit 0 on Node 24** |
| #337 → #338 → #340 → #341 | the UI stack: settings shell, automations list, Inference section, detail frame | 69 tests, both gates green |
| #336 | IN1 provider registry | #340 merges it in |
| #328 #335 #339 | IG7 plan slice, prompt sections, decision 10 | docs only |

**First merge in a day: #334 landed 2026-10-05 14:21Z**, so `ci/check-src.sh`
now exits 0 on Node 24 from `main`. Sixteen PRs remain green and mergeable.
The bottleneck is still merges, not authorship. #307 and #327 both need a
session that authored neither.

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
