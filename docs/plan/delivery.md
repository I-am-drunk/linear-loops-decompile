# From packages to a working product

Existing SH/ST/IN/IG/AU PRs provide building blocks. They do not yet compose a
served application with persisted configuration and an executing automation.
Keep their reviewed code; add these narrow slices in dependency order.

| Slice | Owner | Acceptance |
|---|---|---|
| SH4 composition | #314 | One start command serves shell, assets and routes; direct navigation works |
| ST7 settings persistence | #315 | Save a provider preference, reload, test connection; responses reveal no key |
| AU8 application/store | #318 | Create/edit/publish a versioned automation; reload restores it; invalid commands fail |
| AU9 manual executor | #318 | Run a published version once with a selected provider; persist ordered events and terminal state |
| AU10 UI wiring | #318 | List/editor/run view call the application; progress, errors and cancel work end to end |
| AU11 durable scheduling | #318 | Due work survives restart; one trigger event cannot create duplicate effects |

## Boundaries that must execute

| Boundary | Required enforcement | Owner |
|---|---|---|
| OAuth callback | Bind state to initiating session, expire it and consume it once | IG2 wiring, #370 |
| Credential persistence | Encrypt retrievable secrets; never return them through settings reads | IG2/ST7 |
| Provider/MCP connection | Validate destination and credential transport at dispatch, including resolution/redirect policy | IN/MCP, #365 |
| Tool invocation | Recheck automation allowlist and persisted approval immediately before execution | MCP5/AU9, #370 |
| Pagination/config | Require finite bounded numbers at entry points | AU/IG, #368 |

Importing a policy module does not enforce it. Tests must exercise the actual
callback, dispatch and invocation paths. Merging adjacent PRs does not add
missing calls automatically.

Use one model-tool-call representation between inference and execution. MCP
transports execute tools; they do not replace the provider's tool-call/result
contract. Advertise tool support only when this whole path works.

## Release evidence

For the first runnable flow, exercise the served UI against its real server and
store, with a deterministic provider fixture. Then verify each external adapter
against its versioned protocol before claiming live interoperability. Demonstrate
save/reload, manual run, ordered transcript, failure, cancel and restart recovery.

After adding a scheduler or external effects, prove durable idempotency over
retained history, not a newest-N lookup. Do not mark success before required
side effects finish. Preserve the exact published config and provider selection
used by a run so later settings changes do not rewrite its history.

These cases come from recurring integration failures in issues #75, #87, #96,
#121 and #175. Package tests stay useful; they are insufficient evidence for a
composed user flow. The history index retains those findings and their sources.
