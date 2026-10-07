# T3 Code Connect compatibility

T3 Code Connect is a required provider option. **Interoperability is UNVERIFIED.**
The existing IN4 PR #359 uses our RpcClient and calls `inference.models` and
`inference.chat`. Its ten fixture tests pass, but those methods are not present
in the inspected T3 server/contracts tree. Our transport is not a T3 protocol spec.

## Source audit

Inspected 2026-10-06: public `I-am-drunk/t3code-fork` commit
`b85578aab837c33df5431b5387fffd0021d803a6`.

| Source | Observed contract |
|---|---|
| apps/server/src/auth/http.ts | POST /api/auth/bootstrap/bearer exchanges a credential; POST /api/auth/ws-token issues a WebSocket token |
| packages/contracts/src/auth.ts | Describes bootstrap methods, browser/bearer sessions and expiration |
| packages/contracts/src/orchestration.ts | orchestration.dispatchCommand, subscriptions/replay, thread.turn.start and interruption |
| packages/contracts/src/rpc.ts | server.getConfig and provider refresh/settings methods |

Pinned sources: [authentication](https://github.com/I-am-drunk/t3code-fork/blob/b85578aab837c33df5431b5387fffd0021d803a6/apps/server/src/auth/http.ts),
[orchestration](https://github.com/I-am-drunk/t3code-fork/blob/b85578aab837c33df5431b5387fffd0021d803a6/packages/contracts/src/orchestration.ts),
[RPC catalog](https://github.com/I-am-drunk/t3code-fork/blob/b85578aab837c33df5431b5387fffd0021d803a6/packages/contracts/src/rpc.ts).

These facts describe that source revision, not the owner's running deployment.
The bridge must detect/version its supported server contract and fail clearly
on incompatibility. Do not silently treat a paired socket as a working provider.

## IN4 completion

1. Pin the supported T3 version and implement its actual authentication/RPC transport behind an injected adapter.
2. Discover available provider instances and models; map supported options and capabilities without inventing defaults.
3. Start one real turn, stream its events, interrupt it, and reconnect/replay without duplicate execution.
4. Verify expired/revoked pairing and incompatible server versions. Expose those states in Linear-style settings.
5. Keep tokens server-side and apply destination policy at connection time. Record the end-to-end evidence.

Until then, retain #359 as an explicitly named internal prototype or replace
its wire adapter. API/local providers can progress independently. The old
SPECS/t3-connect.md describes our UI/server transport only.
