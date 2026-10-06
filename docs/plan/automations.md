# Automations

Verify and reproduce Cursor's Automations layout inside the exact Linear shell.
The owner requires per-automation MCP configuration, selectable inference
including T3 Code Connect, and Linear account connection as one integration.

The merged sibling [evidence index](https://github.com/I-am-drunk/cursor-decompile/blob/main/facts/INDEX.md),
[layout contract](https://github.com/I-am-drunk/cursor-decompile/blob/main/specs/automations-layout.md),
and [runtime handoff](https://github.com/I-am-drunk/cursor-decompile/blob/main/specs/linear-as-integration.md)
are the starting references. Public feature docs do not establish geometry.

| Capability | Evidence status |
|---|---|
| Multiple triggers; any trigger can start a run | DOCUMENTED, Cursor A02 |
| MCP server access, per-automation model, repository context | DOCUMENTED, A04–A06; exact tool-picker/cardinality details remain UNVERIFIED |
| Webhook URL/key generated after saving | DOCUMENTED, A08 |
| List columns/order, editor section order, spacing, copy, responsive states | UNVERIFIED until captured and cited |
| Prompt chains and per-step models | DESIGN proposal; neither a verified Cursor feature nor an explicit owner request |

Capture the list, editor and run states before claiming visual parity.
Record the reference route/version, account state, viewport, theme, styles and
interactions under [UI exactness](../UI-EXACTNESS.md). Do not invent missing
columns, sorting rules, section positions or labels.

## Execution design

One application owns versioned definitions, runs and persistence. Schedule,
manual, webhook and integration-event triggers reach the same executor.
Keep schedule-input conversion distinct from the verified recurrence kernel;
a cron control does not establish restart, replay or dedupe behavior.

Each automation selects opaque tool/connection references and a provider/model.
Editing one automation must leave another's bindings unchanged. Connections
can be shared; credentials stay server-side. See [MCP](mcp.md),
[inference](inference.md) and [integrations](integrations.md).

Ship a single-prompt run first. Chaining remains a separate DESIGN slice:
ordered steps may choose models and receive earlier outputs, but acceptance,
failure/cancellation semantics and evidence must be specified before expansion.

Render the shared runtime's states and ordered events. Preserve the published
configuration used by each run; do not invent a second status vocabulary or
scheduler. [Delivery](delivery.md) defines persistence, execution and wiring.

## Slices

These scopes are implementation work, not claims about Cursor's screen layout.

| Slice | Scope | Depends on |
|---|---|---|
| AU1 | captured list states and interactions | reference facts, app shell |
| AU2 | captured editor, save/dirty behavior | AU1, editor facts |
| AU3 | schedule and manual trigger configuration | AU2, shared execution contract |
| AU4 | single prompt and model selection; chaining separately if retained | AU2, inference registry |
| AU5 | per-automation MCP configuration | AU2, MCP contracts and capture |
| AU6 | runs feed and transcript | AU2, shared run contract and capture |
| AU7 | verified context controls; memories/parameters remain DESIGN until specified | AU2, relevant evidence |

AU8–AU11 in [delivery.md](delivery.md) connect these packages to the store,
executor, served UI and durable scheduler. Package tests alone do not complete
the user flow. Product defaults are recorded in [decisions.md](decisions.md).
