# extracts/linear-official — Linear's OWN published API surface (cross-check substrate)

Two kinds of "Linear's code" exist, and the rule for each is different:

| Source | License/status | Rule |
|---|---|---|
| The desktop app bundle/DMG/asar/prettified output (the decompile) | proprietary | **ABSOLUTE BAN** on committing any of it (unchanged — AGENTS.md) |
| **`linear/linear` (GitHub): the official SDK monorepo** | **MIT** (`LICENSE` included here) | Vendoring allowed WITH the license + this provenance note |
| `linear.app/developers` + `linear.app/docs` website text | not openly licensed | Facts, field lists, short quotes, and LINKS only — never wholesale copies (see `AGENT-API.md`, a digest) |

## What's here (full docs drop, 2026-09-27)

Vendored from `linear/linear` @ `689ccc1e905d` (`master`, the DEFAULT branch,
commit dated 2026-09-25), retrieved 2026-09-27.

| File | What | Provenance in upstream repo |
|---|---|---|
| `schema.graphql` | Official public GraphQL schema (SDL, 1,335 KB; 723 types / 129 enums / 402 inputs / 526 root ops) | `packages/sdk/src/schema.graphql` |
| `_generated_documents.graphql` | Every operation the official SDK ships (671 ops, 834 KB) | `packages/sdk/src/_generated_documents.graphql` |
| `LICENSE` | MIT, upstream repo root | `LICENSE` |
| `UPSTREAM-README.md` | Upstream repo README (SDK + import tool overview) | `README.md` |
| `docs/` | Upstream `docs/` verbatim: `API.md`, `OAuth2.md`, `Webhooks.md`, `Attachments.md`, webhook settings screenshots, markdown-magic config/transforms | `docs/` |
| `docs-site/` | **OUR fact digests of the LIVE linear.app/developers pages** (rate limiting, GraphQL basics, pagination/filtering, webhooks, OAuth). Exists because the upstream `docs/*.md` are ONE-LINE STUBS pointing at the website — never cite them as a source. | see `docs-site/README.md` |
| `packages/*/README.md` | Package docs: `sdk` (client usage), `import` (CLI importer), `codegen-doc`, `codegen-sdk`, `codegen-test` | `packages/<pkg>/README.md` |
| `packages/sdk/CHANGELOG.md` | Full SDK changelog (2.1 MB): release-by-release public-API history — the drift-forensics source ("when did op X appear?") | `packages/sdk/CHANGELOG.md` |
| `AGENT-API.md` | OUR digest of the official Agent Sessions surface (+ divergences) | curated from the schema + linear.app/developers (links inside) |

Deliberately NOT vendored (MIT allows it; size says no — fetch on demand):
`packages/sdk/src/*.ts` (`_generated_sdk.ts` 2.1 MB, `_generated_documents.ts`
5.3 MB, `schema.json` 5.9 MB). The two `.graphql` files carry the same interface
facts at ~1/6 the size. If a consumer ever needs the exact TS runtime shapes,
pull from the pinned SHA above and say so in the PR that needs it.

## Refresh (drift watch — same schedule as the decompile pipeline)

**Pin the DEFAULT branch: `master`. NOT `main`.** A stale `main` branch exists
upstream (`4d9cdbf0beb1`, schema 885 KB); a 2026-09-27 drift check fetched it and
reported a false "zero drift" while `master` had grown +63 root ops / +238 types.
Always resolve the default branch first:
`curl -s https://api.github.com/repos/linear/linear | jq -r .default_branch`.

```bash
B=https://raw.githubusercontent.com/linear/linear/master
curl -fO $B/packages/sdk/src/schema.graphql
curl -fO $B/packages/sdk/src/_generated_documents.graphql
# plus docs/, packages/*/README.md, packages/sdk/CHANGELOG.md, LICENSE as needed
```

Diff, log deltas in `KNOWLEDGE.md` §drift, flag affected SPECS on issue #2.
The SDK cuts releases roughly weekly (@linear/sdk on npm).

## The two-source cross-check rule (BINDING)

Anything about Linear can now be checked against TWO independent sources:
1. **OFFICIAL** (this directory + linear.app/developers) — wins for everything the
   public API covers: dataplane ops, auth, webhooks, rate limits, **agent sessions**,
   **agent skills** (CRUD public since the 2026-09-25 schema).
2. **DECOMPILE** (`extracts/` root, `KNOWLEDGE.md`) — wins for what the public API
   does NOT expose: Loops internals (`WorkflowDefinition` has ZERO public
   queries/mutations — re-verified on the 2026-09-25 schema), the AI chat
   send/stream ops (zero public `aiConversation*` root ops — same re-verification),
   trigger semantics, UI structure/parity, sync-protocol behavior.

On conflict: log it in `KNOWLEDGE.md` §drift + flag on issue #2.
