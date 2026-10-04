# STATUS

Updated in the same PR as the work it describes.

**Phase: rearchitecture, 2026-10-04.** Scope widened from Loops-only to the
whole Linear UI; the automations page re-based on Cursor's layout; Linear
demoted to one integration; T3 Code Connect a first-class inference provider;
the decompile-and-publish method retired (`docs/PROVENANCE.md`).

## Lanes

| Lane | Next slice | State |
|---|---|---|
| SH shell | SH1 **shipped** (PR #320) → SH2 layout primitives | SH3 node/markdown tier open |
| ST settings | ST1 settings shell | open |
| IN inference | IN1 provider registry | open |
| IG integrations | IG1 integration interface | open |
| AU automations | AU1 list page | unblocked — SH1 landed |
| MCP mcp | MCP1 registry model | open |

`SH1` landed, so every UI lane is unblocked: `registerSurface(path, fn)` is the
seam. `SH2` (layout primitives) and `SH3` (node/markdown render tier, shared by
the prompt editor and the run transcript) are the next shell slices.

## Open PRs

| PR | What | State |
|---|---|---|
| #320 | SH1 app shell | this PR |
| #307 | team-tree presentation kernel | flat-leg fix applied at `bbc57d4`; needs one reviewer (fix author recused) |
| #312 | review-recipe docs | close as superseded; its raw-vs-pretty rule carried into `pipeline/README.md` with credit |

Merged 2026-10-04: **#308** config seam kernel (first commit on `main` in five
days), **#313** the rearchitecture.

## What exists

Server: transport (`src/connect`), boot + static + store + audit
(`src/server`), settings RPCs, Linear GraphQL client with a header-driven rate
budget. Model layer (`src/model`). Theme (`src/ui-theme`, token-generated).
~16 presentation kernels under `src/ui-*`. Analysis harness (`pipeline/`,
`tools/`).

UI: the shell (`src/ui`) — hash router, nav from the route table, theme tokens
as CSS variables, a placeholder per unclaimed route. Renders in a browser;
surfaces mount via `registerSurface`.

Still empty: every actual surface. The nav is honest about which slice owes
each one.

## History

`docs/LEARNINGS.md` — three eras, 121 issues and 300+ thread comments
distilled. Read it before proposing a process change; most have been tried.
