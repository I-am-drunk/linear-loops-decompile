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
`extracts/config-endpoints.md` (175) enumerate Linear model fields, client
GraphQL operations and client config endpoints, generated from the corpus and
committed to this public repo.

Checked: a sample of operation names from `graphql-ops.md` is absent from the
vendored public MIT schema. **`UNVERIFIED`**: whether *every* row across all
three files is absent from the public surface — nobody has diffed them field
by field, and `config-endpoints.md` has no public counterpart to diff against
at all. So "these are internal, not public" is the working read rather than an
established fact. It does not change the recommendation below, which does not
rest on it.

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

## 10. Cursor's automations layout (owner's call — a session should not settle it)

The lane brief asks for Cursor's automations layout on our page. AU1 (#338)
was built from `docs/plan/automations.md`, the open MCP specification and our
own corpus instead. Recording why, because the directive is unmet and the
owner should know that rather than discover it.

**What exists.** The sibling `cursor-decompile` repo has a 1.2 GB local
corpus and three partial fact files. It stopped on 2026-10-04 and its README
says why.

**Why it stopped.** Seven extractors, one brief ("facts only, never paste
vendor code"). Six declined independently: the rule shaped the format while
the brief asked for the substance, and gitignoring the bundle while
publishing its distillation protects the container, not the content.

**It also produced wrong facts.** The one completed extraction audited the
queue and found 3 of 4 headline strings wrong: `All Automations` is a radio
item in a runs filter, not the list header; `Add Automation` is never
rendered; there is no trigger-summary or last-run cell.

**Working default: build the capability set, not the layout.** Everything the
owner named is reachable from open sources — MCP per automation from the
published specification, cron from POSIX/Vixie, chained prompts with per-step
models from our own provider registry. `docs/plan/automations.md` already
marks the Cursor comparisons `UNVERIFIED` and says the design stands without
them.

**This is NOT settled by #321.** That deleted one doc about our own Linear
corpus method. Extraction of a second vendor's client is a different question
with different exposure, and it is the owner's to answer. If they want it,
`cursor-decompile/README.md` is the fullest record of what the method cost
last time, and the decision should be taken with that in view.
