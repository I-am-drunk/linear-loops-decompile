# SPEC — Linear's LSE sync protocol (reference only — we do NOT build this)

Documented so every agent understands (a) why reusing Linear's client wholesale was
rejected, and (b) the concepts our simpler T3 transport must still cover.
Facts from KNOWLEDGE.md §4.

## Shape

- Control + data over one WebSocket: `wss://sync.linear.app` (params: userId,
  userAccountId, compression).
- Handshake `hshk` carries DB identity (`clientDatabaseId`), `protocolVersion:3`,
  client version, `cellName`, `token`; server replies with initial sync + lastSyncId.
- Models replicate as ordered deltas keyed by `lastSyncId`; hydration of big collections
  via HTTP `restModelsStream`; lazy per-query hydration with placeholders.
- Live AI output rides `streamData`; presence/typing via `ephm`/`ephp`; pings keep alive;
  idle users get disconnected deliberately.
- Payloads: binary frames, custom packer, optional zstd w/ server-pinned dictionary
  (SHA256-verified, versioned, `zstd-v1`).
- Writes: client builds GraphQL mutations per model transaction, batches them, queues
  offline with rollback snapshots, retries on lock-timeout/ratelimit with backoff.

## Why we don't build it

Two implementations required (server + client), versioned binary protocol, compression
dictionaries, offline transaction logs — weeks for zero product gain, since BOTH ends of
our system are ours. Linear needs it for offline-first multi-device gigamodel sync; we
need "UI sees server state quickly."

## What we still need (covered by SPECS/t3-connect.md)

- Server-authoritative state (SQLite) + read RPCs.
- Live run streaming (parts as they're produced) + run list/detail invalidations.
- Presence-lite (is a run active) — trivial heartbeat.
- Reconnect with resume (last seen runPart id), not full offline sync.
