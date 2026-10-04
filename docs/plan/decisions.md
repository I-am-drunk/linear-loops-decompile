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
