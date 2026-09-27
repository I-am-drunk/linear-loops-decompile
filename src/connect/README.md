# @loops/connect — T3-style UI ↔ server transport (R9)

Implements SPECS/t3-connect.md. This REPLACES Linear's sync protocol for our
UI (see SPECS/sync-protocol.md for what we deliberately do not build).
Zero runtime dependencies; Node 22 + node:http only. Original code.

| File | Concept | Spec section |
|---|---|---|
| `descriptor.ts` | `GET /.well-known/t3/environment` — discovery | §1 |
| `pairing.ts` | one-time pairing offers (`loops://pair?url=…&token=…` = QR payload) + headless device flow | §2 |
| `tokens.ts` | scoped session tokens: `t3_`+24B, sha256 at rest, revocable/expiring, closed scope set | §2 + tokens note |
| `ws.ts` | zero-dep RFC 6455 server codec (Node has no WS server) | §4 |
| `rpc.ts` | JSON-RPC-ish frames, stable STRING error codes (no batches) | §4 |
| `channel.ts` | auth, scope gates, subscriptions, per-run seq + ring buffer replay, presence-lite | §4 + RPC surface v1 |
| `client.ts` | Node 22 WebSocket client: reconnect + sinceSeq resume. Doubles as the browser-client reference | §4 |

## Wire protocol (v1)

- Socket: `GET /connect` upgrade. JSON text frames only.
- Auth (either):
  - Subprotocol: offer `t3.<token>`; server echoes it on accept. Bad token →
    HTTP 401 before the upgrade.
  - First frame: `{"jsonrpc":"2.0","id":1,"method":"auth","params":{"token":"t3_…"}}`
    → `{result:{ok:true,scopes}}`. Bad token → error + close 4401.
  - Either way: unauthenticated sockets are closed with 4401 after
    `authTimeoutMs` (default 5s).
- Requests `{jsonrpc:"2.0",id,method,params?}` → `{id,result}` or
  `{id,error:{code,message}}`. Notifications have no id. No batches.
- Errors carry stable string codes: parse_error, invalid_request,
  method_not_found, invalid_params, unauthorized, token_expired,
  token_revoked, insufficient_scope, not_found, loop_disabled, rate_limited,
  replay_gap, unavailable, internal_error.
- Run events stream as `{method:"runs.event",params:{runId,seq,event}}`.
  `seq` is per-run monotonic. `runs.subscribe(id, sinceSeq?)` replays retained
  events (`ringBufferSize`, default 500/run) and reports
  `{ok, active, replayed, truncated}` — `active` is presence-lite; when
  `truncated` is true the window could not cover the gap: resync with
  `runs.get`. There is no `runs.unsubscribe` in v1 — close the socket or drop
  the subscription client-side.
- Scope gates: METHOD_SCOPES maps every v1 method to the closed scope set
  (`env:read`, `loops:read|write`, `runs:read|write`, `settings:read|write`).
  Revoked/expired tokens fail their NEXT call — no reconnect needed.

## Method ownership

The channel owns: `auth`, `env.describe` (given a descriptor), `runs.subscribe`,
and the `runs.steer|cancel|continue` delegation to the injected
`RuntimeCommands` seam (R5's runner). Everything else (`loops.*`, `settings.*`,
`dataplane.probe`) is registered by the composition root — src/server
(T-1101) mounts the descriptor handler at `/.well-known/t3/environment` and
attaches this channel to its `upgrade` event.

## House style

`.ts` import extensions (verbatimModuleSyntax + allowImportingTsExtensions);
`npm run typecheck` = `tsc --noEmit` (strict set); `npm test` =
`node --experimental-strip-types --test *.test.ts` (Node 22 type-stripping —
no build step, no tsx).

