# Shared protocol adapter contract

**DESIGN, interfaces only.** `src/inference/protocol.ts` is a server-side port
for future Linear chat and T3 Code Connect implementations. It neither
registers a provider nor changes the existing text-only `Provider`.
There are no live calls, credentials, UI or runtime dependencies in this slice.
Sources: [static audit](linear-chat-static-audit.md), [integration map](linear-chat-integration-map.md),
[inference plan](plan/inference.md), [T3 plan](plan/t3-code-connect.md).

## Lifecycle and ownership

1. The host constructs a connection-bound adapter with private credentials
   and destination policy. `inspect` validates connection/protocol without a
   turn; capabilities distinguish verified, unsupported and unverified.
   Connected is not shorthand for verified send/stream/cancel/replay.
2. `models` reports only actual discovery. `provider-default` requires its
   own capability evidence; an empty model list never invents a default.
   This version takes one user text input, not arbitrary history, options,
   attachments or local tool definitions. Extensions need separate evidence.
   `estimate` is local-only; unknown pricing remains unknown. Actual usage
   and cost belong to the reconciled snapshot, not a guessed token count.
3. `prepare` is local-only. The host durably records request, attempt ID and
   returned reference before `send`. Adapters reject a request/reference or
   connection mismatch without dispatch. IDs are correlation, not proof of
   remote idempotency. Persist newly returned identifiers immediately.
4. Write results distinguish not-dispatched, explicit rejection, acknowledgment
   and unknown outcome. Once any send bytes might have left the process,
   timeout/disconnect means indeterminate, not safe fallback. Reconcile by
   reference; never automatically resend or move to another provider.
5. `snapshot` performs a read. Nullable parts mean not hydrated. `observe`
   emits replacement snapshots with stable local event IDs, or resyncRequired;
   adapters apply document steps and deduplicate before publishing. Persist
   state and checkpoint together. Stream exhaustion is not completion.
6. Cancel acknowledgment is not terminal confirmation. Re-read the target
   turn; local abort/deadline only ends waiting. Resume checkpoints are opaque,
   bound to connection/run/attempt, and never ordered by generic host code.
   Reject mismatched checkpoints before reading; unavailable replay requires
   hydration, not a new send.

7. `respond` requires host authorization of actor/run/turn/request/action and
   a durable decision audit ID. Advertise only verified response actions:
   the union can represent a decline but does not assert Linear accepts it.
   Unknown writes require reconciliation here too. Provider tool activities
   are observations, never requests to re-execute a tool through local MCP.
8. Complete only a correlated target turn. Suspend on input/waiting; preserve
   policy failures and unsupported parts instead of returning empty success.
   Unknown usage/cost has no numerical value. Sanitize content, tool data,
   identifiers and errors before logs/UI; type annotations do not sanitize.

The existing registry resolves another candidate on `unavailable`,
`unconfigured` or `rateLimited` reachability failures; it does not dispatch
chat retries. A future bridge must not downcast an indeterminate write,
suspension or protocol incompatibility into an ordinary text result or
retryable failure. That bridge and runtime enforcement/tests are explicitly
**not implemented**.

## Provider-specific mapping, not a shared wire protocol

| Port concept | Linear chat | T3 Code Connect |
|---|---|---|
| Selection | Model selection/default availability UNVERIFIED; do not import coding-session model names | `ModelSelection` plus provider instance, only as discovered from the peer |
| Prepare/send | Persist conversation/user-message IDs; S3 send returns authoritative IDs | Persist command/thread/message IDs; `thread.turn.start` through `orchestration.dispatchCommand` |
| Acknowledgment | `success`, `lastSyncId`, returned IDs, not generation completion | `DispatchResult.sequence`, not assistant completion or a turn ID |
| Read/replay | Candidate polling still UNVERIFIED; per-property cursors/baselines in S2/S5 | Thread stream union includes snapshots/events; replay input is `fromSequenceExclusive` |
| Cancel | S3 `aiConversationCancel`, reconcile actual outcome | `thread.turn.interrupt`, optional turn ID; correlate target before treating as canceled |
| Decisions | S6 typed wrappers; confirmation encoder observes true only | Separate `thread.approval.respond` and `thread.user-input.respond` |

T3 rows rechecked at the plan's pinned
`I-am-drunk/t3code-fork@b85578aab837c33df5431b5387fffd0021d803a6`,
`packages/contracts/src/orchestration.ts`: lines 64–115 (model selection),
440–451 and 1103–1113 (thread stream), 568–631 (turn/decision commands),
1174–1237 (dispatch/replay schemas).
SHA-256: `e0c9c1a9c8db5a1044df62a0f30680a5f09ff9c68193d7e17e9613a716f9dd23`.
The contract proves field shapes, not deployed version negotiation,
exactly-once execution or live compatibility. In particular, do not carry
Linear cursor ordering assumptions into T3 sequences, or vice versa.
Both adapters still owe the live acceptance tests in their respective plans.
