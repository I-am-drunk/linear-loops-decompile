# SPEC — T3-style connect (our UI ↔ server transport)

Adopted from the user's T3 Code Connect pattern (hub project): remote access without port
forwarding, pairing-based auth, every machine an "environment". This replaces Linear's
sync socket entirely (see sync-protocol.md).

## Pieces

1. **Environment descriptor** — server serves `/.well-known/t3/environment`:
   `{ id, label, platform, capabilities: ["loops","runs","settings"], protocol: 1,
      product: "loops-server", version }`. Discovery = fetch descriptor.
2. **Pairing** — `t3 pair` (or UI "Pair device") prints a connection string + QR:
   `{ url, pairingToken }` (short-lived, one-time). Exchange pairing token → scoped
   session token (`env:read`, `runs:write`, `settings:write`). Headless: OAuth device flow.
   Reusable dev token for local development.
3. **Tunnel (optional)** — managed cloudflared dialing OUT from the home server; the
   connection string embeds the tunnel hostname. No inbound firewall changes.
4. **Channel** — WSS JSON-RPC 2.0-ish, typed methods; one socket per session token.

## RPC surface (v1)

```
env.describe()                      → descriptor
loops.list() / loops.get(id)        → config(s) (from server DB)
loops.upsert(draft) / loops.publish(id) / loops.setEnabled(id,bool)
runs.list(loopId?) / runs.get(id)
runs.subscribe(id)                  → events: part{…} | status{…} | usage{…} | done
runs.steer(id, text) / runs.cancel(id)
runs.continue(id, text)             → new turn in same run
settings.get() / settings.setLinear{…} / settings.setInference{…}
settings.testInference()            → probe result (models, latency)
dataplane.probe()                   → Linear connectivity + rate budget
```

- Events carry monotonically increasing `seq` per run; client reconnects with
  `runs.subscribe(id, sinceSeq)` to resume gaps. Server buffers the last N events/run.
- Errors: JSON-RPC error objects with stable `code` strings (`unauthorized`,
  `rate_limited`, `not_found`, `loop_disabled`, …).
- Tokens: bearer in `Sec-WebSocket-Protocol` or first-frame `auth`; scoped; revocable;
  stored server-side hashed.
- Server keeps zero client state beyond subscriptions; UI is a thin view. Presence-lite:
  server emits `runs.active[]` on subscribe.

## Non-goals (v1)

Offline writes, model replication, compression dictionaries, multi-device conflict
resolution. If we ever need them, sync-protocol.md says what we're in for.
