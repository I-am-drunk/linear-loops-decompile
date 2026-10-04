# Open decisions

Owner-facing forks. Each has a working default so nothing blocks; a default
holds until the owner says otherwise.

| # | Decision | Working default |
|---|---|---|
| 1 | Credit metering | **OUT.** Self-hosted has no Linear billing. Run cost comes from our own provider accounting. |
| 2 | Run retention | **Configurable prune, default 90 days.** Runs are ours; unbounded growth is the only wrong answer. |
| 3 | MCP tool support | **Our own server-side MCP client.** Settled by the Cursor-style layout — see `mcp.md`. |
| 4 | Multi-user | **Single-user first.** The model carries a user id so multi-user is additive, but no invite flow in milestone one. |
| 5 | Linear chat route as a provider | **Not built.** The owner has their own inference; this was never load-bearing and gated too much for too long. |
| 6 | Notification deep links | **OUT.** Notifications live in Linear, which the owner keeps using. |
| 7 | Collaborative draft editing | **OUT.** Single-editor drafts. |

## Decided during the rearchitecture

- **Provenance.** We do not publish byte-fidelity transcriptions of vendor
  internals. `docs/PROVENANCE.md`. Not reversible by a session; raise it with
  the owner if you think a case differs.
- **The automations layout is Cursor's, not Linear's** — owner directive.
- **Linear is one integration** — owner directive.
- **Progress is measured in working surfaces**, not golden-chunk counts. The
  old meter rewarded apparatus over product.

## 8. The pre-existing corpus-derived extracts (owner's call)

`extracts/models.md` (3,427 lines), `extracts/graphql-ops.md` (380) and
`extracts/config-endpoints.md` (175) enumerate Linear's internal model fields
and GraphQL operations, generated from the corpus and committed to this public
repo. None of their operations appear in the public MIT schema, so they are
internal surface, not public API.

`docs/PROVENANCE.md` forbids producing more of this. These three predate the
rule, and deleting ~4,000 lines of prior work is the owner's decision rather
than a session's — so: **nothing regenerates or extends them** (the pipeline
step that refreshed them is removed), and they stay until the owner rules.

Worth noting on each side. *For keeping*: an operation name plus its variable
signature is wire-protocol shaped, and interoperability is the strongest case
there is for reading someone's protocol. *For removing*: they are an
enumeration of a competitor's internal API, published, and nothing in the
current plan uses them — the plan reads the **public** API, for which we have
the MIT schema.

Recommendation: remove them. Nothing depends on them and the asymmetry is bad —
we would not accept the same extraction of our own internals.
