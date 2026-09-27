# connect: the UI <-> server transport

Zero-dependency WebSocket JSON-RPC (SPECS/t3-connect.md). Server mounts on any
`node:http` server at `/ws`; clients use the global `WebSocket`.

- Auth: first frame is an `auth` request carrying the session token.
- Calls resolve by id; events are notifications with a per-run `seq`.
- Error codes are stable strings (`unauthorized`, `method_not_found`,
  `invalid_params`, `rate_limited`, `not_found`, `loop_disabled`, `internal`).

Test: `node --experimental-strip-types --test connect.test.ts` (or the repo gate).
