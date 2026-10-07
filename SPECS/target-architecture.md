# Target architecture

Build the whole Linear workspace UI with Cursor's automation layout,
configurable inference and independent integrations. This is the target;
STATUS.md distinguishes packages from delivered application flows.

| Boundary | Owns | Existing or planned home |
|---|---|---|
| Workspace UI | Routes, navigation, theme, settings and feature views | src/ui-* |
| Application | Commands, validation, identity, persistence and composition | src/server |
| Domain | Automation versions, triggers, runs and stable identifiers | src/model |
| Execution | Scheduling, queue, turn lifecycle, cancellation and events | planned src/runtime |
| Inference | Provider/model discovery, invocation, capability and usage mapping | src/inference* PRs |
| Integrations | Entities, incoming events, audited actions and account state | src/integrations* PRs |
| Tools | MCP transport, discovery, per-automation allowlist and approvals | src/mcp PRs |

Dependencies point inward: views call application commands; application and
execution depend on domain types and injected ports; adapters implement those
ports. The server is the composition root. UI code does not open provider
connections or implement OAuth, and providers do not depend on Linear models.
Keep current package paths while feature stacks land; move code only in a
separate behavior-preserving slice, never by copying a competing implementation.

## Data and credentials

Our store owns drafts, published versions, schedules, durable run/idempotency
records, transcripts, settings and credential references. Each record is scoped
to its workspace. Integrations supply external entities without becoming the
automation model. Connecting Linear is optional for local runs.

The server validates commands and resolves credentials. Settings returns
presence/status hints, never secrets. OAuth callback state, token encryption,
destination checks and tool approvals must run at their actual boundaries;
interface comments are not enforcement. See #365 and #370.

## One execution path

A manual command, schedule or integration event produces a stable trigger id.
Persist the run and its published automation version before dispatch. The
executor resolves each step's provider/model, streams ordered events, checks
per-automation tools and approval at invocation, and records terminal state.
Only report success after required actions complete. Cancellation and restart
recovery are part of this path. Full-history idempotency cannot be implemented
by searching only the newest runs.

The UI reads snapshots and subscribes from a durable event cursor. Reconnect
must neither repeat actions nor hide output. Rendering packages and mocked
provider tests alone do not verify this composition.

## External protocols

`src/connect` is our UI/server transport, documented in SPECS/t3-connect.md.
It does not establish compatibility with T3 Code. The provider bridge needs
its own versioned protocol evidence and integration test; see
docs/plan/t3-code-connect.md. Linear uses its public OAuth/GraphQL/webhook APIs.
MCP uses the published protocol. These are independent adapters.

Milestones and application slices: PLAN.md and docs/plan/delivery.md.
