# Decisions and working defaults

Owner directives set the product target. Working defaults guide implementation
until revised; they are not claims about shipped behavior or vendor policy.

## Owner directives

- Reimplement the whole Linear UI exactly with original code and verified
  evidence; use Cursor's verified Automations layout for the Loops page.
- Treat Linear as one integration with account sign-in. Make inference
  configurable, including T3 Code Connect, through Linear-style settings.
- Support MCP configuration per automation. Preserve useful findings in files
  and coordinate through concise GitHub CLI claims and reviewed PRs.

UI values require citations and matching reference states. A passing facts
declaration check alone does not prove visual parity.

## Preserved decision IDs

| # | Decision | Basis | Current direction |
|---|---|---|---|
| 1 | Credit metering | Working default | Record provider-reported run costs. Defer a product credit policy; infer no Linear pricing or shared-wallet behavior. |
| 2 | Run retention | Working default | Configurable pruning, proposed default 90 days; document and test retention before enabling deletion. |
| 3 | MCP tool support | Owner feature; implementation default | Per-automation bindings with our server-side MCP client; see [mcp.md](mcp.md). Layout alone does not specify execution policy. |
| 4 | Multi-user | Working default | Single-user first; retain user identity in data contracts so later users do not require a new model. |
| 5 | Linear chat route as a provider | Working default | Deferred. The configurable provider registry is primary. IG7 agent-session presentation is a separate integration; it does not supply or prove free inference. |
| 6 | Notification deep links | Working default | Deferred within whole-UI scope. Revisit with captured routes, permissions and notification behavior. |
| 7 | Collaborative draft editing | Working default | Single-editor drafts first. Collaboration remains future work requiring a defined persistence and conflict model. |
| 8 | Legacy corpus-derived extracts | Open cleanup decision | Audit sources and consumers, then retain, archive or remove by relevance and provenance. Removal remains a proposal; unsupported rows stay UNVERIFIED. |
| 9 | UI evidence method | Owner directive | Exact visual and behavioral parity from verified evidence; declaration checks support reference comparisons rather than replace them. |
| 10 | Automation layout | Owner directive, carried from #339 | Cursor's exact layout inside Linear's shell; capture missing states before claiming parity. |

For #8, the tracked `extracts/models.md`, `extracts/graphql-ops.md` and
`extracts/config-endpoints.md` are historical snapshots. The normal
`pipeline/run.sh` invokes the analyzer with output under
`pipeline/corpus/analysis`; it does not refresh those tracked files. A name in
a snapshot or schema is not proof that a public operation is supported. Keep
raw reference artifacts local and cite only facts needed for an implementation.

Prompt chaining and per-step model selection are DESIGN proposals in
[automations.md](automations.md), not additional owner directives. Judge
progress by working, verified user flows; component counts do not establish
completion. The broader scope and delivery order live in [PLAN.md](../../PLAN.md).
