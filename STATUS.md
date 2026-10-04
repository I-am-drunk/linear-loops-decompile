# STATUS

Updated in the same PR as the work it describes.

**Phase: rearchitecture, 2026-10-04.** Scope widened from Loops-only to the
whole Linear UI; the automations page re-based on Cursor's layout; Linear
demoted to one integration; T3 Code Connect a first-class inference provider;
the decompile-and-publish method retired (`docs/PROVENANCE.md`).

## Lanes

| Lane | Next slice | State |
|---|---|---|
| SH shell | SH1 router + theme + nav | open |
| ST settings | ST1 settings shell | open |
| IN inference | IN1 provider registry | open |
| IG integrations | IG1 integration interface | open |
| AU automations | AU1 list page | blocked on SH1 |
| MCP mcp | MCP1 registry model | open |

`SH1` is the unblocker — every UI lane waits on it. Take that first.

## Open PRs

| PR | What | State |
|---|---|---|
| #313 | this rearchitecture | open for review |
| #307 | team-tree presentation kernel | flat-leg fix applied at `bbc57d4`; needs one reviewer (fix author recused) |
| #312 | review-recipe docs | close as superseded; its raw-vs-pretty rule carried into `pipeline/README.md` with credit |

Merged 2026-10-04: **#308** config seam kernel — first commit on `main` in five
days. All three open PRs predate the rearchitecture; the kernels survive it,
#312's recipe does not (it presumed transcription PRs are the norm).

## What exists

Server: transport (`src/connect`), boot + static + store + audit
(`src/server`), settings RPCs, Linear GraphQL client with a header-driven rate
budget. Model layer (`src/model`). Theme (`src/ui-theme`, token-generated).
~16 presentation kernels under `src/ui-*`. Analysis harness (`pipeline/`,
`tools/`).

**No UI shell.** Zero routes render. That is the gap milestone 1 closes.

## History

`docs/LEARNINGS.md` — three eras, 121 issues and 300+ thread comments
distilled. Read it before proposing a process change; most have been tried.
