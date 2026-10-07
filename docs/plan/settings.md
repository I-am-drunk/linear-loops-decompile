# Settings

Reproduce Linear's settings navigation, typography, spacing, controls and
interaction states from verified reference evidence. Read
[UI-EXACTNESS](../UI-EXACTNESS.md) before implementation. A generic sidebar and
rows do not establish parity. Record the reference version, route and state.

Our provider and integration controls use these verified patterns. Product
configuration below is our design; it is not a claim about Linear's features.

| Section | Configuration |
|---|---|
| Workspace / Account | Identity, theme and deployment preferences |
| Inference | Add/edit/test providers, including T3 Code Connect; model defaults |
| Integrations | Connect/status/disconnect, including Linear OAuth |
| MCP servers | Server registry, authentication and connection status |
| Automations | Timezone, retention and concurrency defaults |

Credentials are write-only through the settings API. Responses expose presence
and status, never secret values. Preferences must survive reload. Connection,
expiry, validation and unavailable-provider states need explicit behavior.

Use the existing theme module where its output matches the target component.
Generator defaults are not always rendered values; check the documented
StyleX distinction. Reuse verified rows for toggles, selections, text inputs,
credential entry and connection status without inventing their dimensions.

| Slice | Scope | Depends on |
|---|---|---|
| ST1 | Settings frame, navigation and routing | SH1 |
| ST2 | Evidence-backed row/control patterns | ST1 |
| ST3 | Inference section | ST2, IN1 |
| ST4 | Integration section | ST2, IG1 |
| ST5 | MCP section | ST2, MCP1 |
| ST6 | Workspace, account and automation defaults | ST2 |
| ST7 | Application wiring: save, reload, test connection, secret-safe responses | SH4, ST3 |

Later workspace/team/administration sections remain in the
[whole-UI roadmap](surfaces.md); the first automation is a delivery milestone,
not a permanent limit on settings coverage.
