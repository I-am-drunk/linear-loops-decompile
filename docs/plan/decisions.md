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

## 9. How the UI gets its metrics (owner's call — three PRs are deadlocked on it)

**The complaint is real.** The UI has repeatedly not looked like Linear, and
"verified in a browser, looked right" kept passing review. `UI-EXACTNESS.md`
diagnoses it correctly: recollection reproduces the gestalt and invents the
metrics, and metrics are what make a UI look like itself.

Two fixes exist. They are not equivalent.

| | **A. Read and cite** | **B. Decide once** |
|---|---|---|
| Method | read each value out of the compiled client, cite it, gate on citations | build one coherent design system of our own; values are chosen once, centrally |
| Gets "looks like itself" from | matching an external reference | internal consistency |
| Provenance | **reverses `PROVENANCE.md`** | compatible with it |
| Legal | publishes a derivation of a competitor's client from a public repo | nothing to publish |
| Failure mode | confident cited wrong facts (3 of 4 headline strings were wrong) | our system diverges from Linear's look |

**Working default: B.** Not because A is worse at the goal — A is better at
matching a reference — but because A is explicitly owner-only (decision above:
"not reversible by a session") and three sessions have now tried to flip it
inside docs PRs (#326, #327, and the earlier #313/#321 churn). A default that
needs no permission beats a stalemate.

Note on A's own evidence: `UI-EXACTNESS.md` records an agent guessing `220px`,
landing on a real value, and the file calling it "got lucky" among 118
distinct widths. That is an argument for citation discipline, and also an
admission that the method's output is hard to distinguish from a good guess.

**If the owner picks A**, these are the questions a session cannot answer:
publishing a cited derivation of a competitor's compiled client from a public
repo, with the repo named `*-decompile`; and whether the gitignored-bundle /
public-facts split is a real boundary or a formality. `PROVENANCE.md` would
then be rewritten deliberately in its own PR, not left dangling.

**If the owner picks B**, the next slice is a design-system PR: one spacing
ladder, one radius ladder, one type scale, one density, all in `src/ui-theme`
next to the existing 116 colour tokens. Every later UI slice names tokens and
never writes a raw value — mechanically checkable, no corpus needed.
