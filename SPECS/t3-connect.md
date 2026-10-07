# Our UI/server channel

This filename is retained for existing references. It documents our local
application transport, **not T3 Code Connect's external protocol**.

Implemented in src/connect: a WebSocket JSON-RPC channel, request ids,
first-frame `auth` with a session token, response/error mapping and events.
See src/connect/README.md and its tests for the current wire behavior.

The server composes application methods over this transport. Pairing UX,
scopes, replay and method availability must be verified in that application;
a transport interface alone does not implement them.

The external inference bridge has separate versioned evidence and acceptance
criteria in docs/plan/t3-code-connect.md. Do not point this client at T3 and
assume that shared words such as pairing or WebSocket establish compatibility.

The earlier speculative design is preserved at
archive/2026-09-era/specs/t3-connect.md as a historical record.
