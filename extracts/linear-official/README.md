# extracts/linear-official — Linear's OWN published API surface (cross-check substrate)

Two kinds of "Linear's code" exist, and the rule for each is different:

| Source | License/status | Rule |
|---|---|---|
| The desktop app bundle/DMG/asar/prettified output (the decompile) | proprietary | **ABSOLUTE BAN** on committing any of it (unchanged — COORDINATION §9) |
| **`linear/linear` (GitHub): the official SDK monorepo** | **MIT** (`LICENSE` included here) | Vendoring allowed WITH the license + this provenance note |
| `linear.app/developers` + `linear.app/docs` website text | not openly licensed | Facts, field lists, short quotes, and LINKS only — never wholesale copies (see `AGENT-API.md`, a digest) |

## What's here

| File | What | Provenance |
|---|---|---|
| `schema.graphql` | The official public GraphQL schema (SDL, 885 KB) | `linear/linear@main:packages/sdk/src/schema.graphql`, retrieved 2026-09-27 |
| `_generated_documents.graphql` | Every operation the official SDK ships (577 ops, 538 KB) | same repo, `packages/sdk/src/_generated_documents.graphql` |
| `LICENSE` | MIT, repo root of `linear/linear` | same |
| `AGENT-API.md` | Digest of the official Agent Sessions surface (+ our divergences) | curated from the schema + linear.app/developers (links inside) |

Refresh (drift watch, R1 slot — same schedule as the decompile pipeline):
`curl -O https://raw.githubusercontent.com/linear/linear/main/packages/sdk/src/schema.graphql`
(+ `_generated_documents.graphql`), diff, log deltas in `work/LOG.md`, flag affected
SPECS on the hub. The SDK cuts releases roughly weekly (@linear/sdk on npm).

## The two-source cross-check rule (BINDING)

Anything about Linear can now be checked against TWO independent sources:
1. **OFFICIAL** (this directory + linear.app/developers) — wins for everything the
   public API covers: dataplane ops, auth, webhooks, rate limits, **agent sessions**.
2. **DECOMPILE** (`extracts/` root, `KNOWLEDGE.md`) — wins for what the public API
   does NOT expose: Loops internals (`WorkflowDefinition` appears in the official
   schema as a type but has ZERO public queries/mutations — verified 2026-09-27),
   trigger semantics, UI structure/parity, sync-protocol behavior.

On conflict: log it in `KNOWLEDGE.md` §drift + flag on the hub. Example settled
2026-09-27: our runtime's `canceled` state vs official `AgentSessionStatus.stale`
(see AGENT-API.md §Divergences).
