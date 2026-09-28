# Security boundaries

The September 28, 2026 findings export contained eight findings. The fixes and
regression coverage are mapped below.

| Finding ID (prefix) | Boundary | Fix |
|---|---|---|
| f86a3df8 | Inference credentials | Changing a harness base URL or provider clears its old key unless a replacement is supplied. Probes require a key and refuse redirects. |
| ca5e367a | RPC transport | The executable server binds to 127.0.0.1. The RPC client requires WSS for every destination except literal loopback IPs. |
| 5415e34e | Credential storage | An owner-only directory, database and SQLite sidecars are required. Existing unsafe ownership/modes, symlinks and hard-linked database files are rejected. |
| 50bc4fa5 | Landing automation | Imported issue bodies and comments must come from the same authorized account as the command. Untrusted blocks cannot override approved blocks. |
| 1c621c8a | WebSocket resources | 4 KiB before authentication, 1 MiB afterward, including fragmented message totals; at most 1,024 fragments. Payloads are allocated once after validating length. |
| 15e12b6a | Corpus paths | Dependency names must be safe basenames, writes remain inside the temporary directory, and actual JavaScript imports are parsed with pinned Acorn. Stub/driver files and corpus symlinks must remain in their declared roots. |
| 0809367b | Parity extraction | Sets deduplicate order keys while vectors preserve order. Matching chunks over 16 MiB fail extraction. |
| 0127da3e | Captured code execution | A separate Bubblewrap process receives only the copied closure, declared driver, runner and runtime libraries. No host environment, network or writable host mounts. Node permissions additionally deny filesystem writes, child processes and native addons. |

## Server operation

Start with `node src/server/start.ts`. The database defaults to
`./data/loops.db`; a new data directory is created with mode 0700 and the database
with mode 0600. `LOOPS_DB` can select another path, whose containing directory
must already be private or be newly created by the server. Unsafe existing
storage is rejected rather than silently changing permissions. Before migrating an
old database, stop the server, confirm ownership, move it and its SQLite sidecars
into a private directory, and make each file owner-readable/writable only.

For remote access, terminate HTTPS/WSS at a TLS reverse proxy forwarding to the
loopback listener. Clients must use its `wss://` URL. The listener itself is HTTP;
embedding applications using `createLoopsServer()` must preserve the loopback or
TLS boundary. Local RPC URLs should use `ws://127.0.0.1` or `ws://[::1]`.

## Corpus execution

Execution requires Linux, Node 24 or newer, and `bwrap` (Bubblewrap) with enabled
user namespaces. Install the parser with `npm ci --prefix tools/corpus-exec`.
The UI gate performs this dependency step. Execution fails closed if isolation
cannot start; there is no unsafe fallback. Non-Linux users can run the harness
inside a Linux development environment supporting these namespaces.

The worker uses a fresh network/PID/user namespace, drops capabilities, clears its
environment, and has only read-only input mounts. `/tmp` and `/dev` are ephemeral.
There is no host `/proc` mount. Node's permission model restricts reads to the
closure, driver and runner and denies subprocesses and writes. Each execution has
a 30-second deadline, a 256 MiB V8 old-space limit, and a 16 MiB output limit.
The heap limit is not a total OS memory quota; use an outer cgroup/container quota
when processing hostile corpora at scale. The OS kernel and Node runtime remain
part of the trusted computing base.

Drivers are copied as a single ESM file; helpers must be inlined or loaded through
`sandbox.load()` from the declared closure. Stub/driver sources may not escape
the case directory, including through symlinks. Literal `./basename` imports,
re-exports, and dynamic imports are included in the closure. Computed, bare,
absolute, and traversing imports are rejected. Comments and ordinary string
literals do not add dependencies.

Serialized output crosses the process boundary using the existing tagged grammar,
preserving golden bytes, sparse arrays, null prototypes, React element projections,
and special numeric values. Real-corpus golden re-verification still requires the
private corpus; synthetic security fixtures are committed and run without it.
