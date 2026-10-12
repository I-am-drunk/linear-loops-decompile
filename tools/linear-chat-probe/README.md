# Linear chat protocol probe

Original Node 22.18+ code; builtins only, no install or runtime dependencies.
This is a candidate send-and-poll experiment, **not a verified Linear provider**.
See the [map](../../docs/linear-chat-integration-map.md) and
[experiment ledger](../../docs/linear-chat-experiments.md).

## Safe offline run

From the repository root:

```sh
node tools/linear-chat-probe/main.mjs --dry-run
node --test tools/linear-chat-probe/*.test.mjs
```

Dry-run performs no requests and needs no token. `evidence/dry-run.json` is
its deterministic output, not a successful live transcript. All IDs are
fictional. The source-verified list query only selects IDs; the probe's
`id.eq` filter and expanded `status`/`parts` selection remain **UNVERIFIED**.
The script validates this selection with a read before any mutation.

## Exact live inputs

Only use a new sacrificial workspace with chat entitlement. Establish the
supported session credential issuance/export method first; do not substitute
a public API key or the one-time email code. Node has no browser cookie jar:
token-only acceptance is itself unverified. Do not extract a personal profile.

Create `.local/config.json` inside the probe directory (directory ignored; file
mode **0600**, regular file, at most 32 KiB). Copy the fields from `sample.mjs`:

| Field | Required value |
|---|---|
| `token` | Raw client-session authorization value, not a guessed Bearer prefix |
| `userId` | Workspace membership UUID, observed in the `user` header |
| `userAccountId` | Account UUID, observed in `userAccount` |
| `organizationId` | Workspace UUID, observed in `organization` |
| `clientId` | Observed `Linear-Client-ID`, not a user UUID |
| `clientVersion` | Observed `Linear-Client-Version`, not the desktop app version |
| `message` | Harmless text; suggested phrase is in `sample.mjs` |
| `timeoutMs`, `pollMs` | Optional; defaults 120000 ms total and 1000 ms between reads |

Never put a token in the command line, shell history, issue, PR or evidence.
After privately creating the file, the explicit live command is:

```sh
node tools/linear-chat-probe/main.mjs --live \
  --config tools/linear-chat-probe/.local/config.json
```

This may consume provider usage. No paid upgrade or credit top-up is performed.
There is no arbitrary endpoint, cookie import, source-flag, workflow-creation,
elicitation-response or remote-cancel option. Fresh UUIDs are generated for
every invocation; invoking it again is **another message**, not a retry.

The probe preflights the poll query, submits one send, then queries the returned
conversation until correlated assistant content is complete, input is needed,
an error occurs, or the total deadline expires. A stalled fetch/body shares
that deadline. Bodies are bounded to 1 MiB and redirects are refused.
Schema rejection at preflight sends zero messages. It never retries a send.

Default output contains status, IDs, counts and a content hash/byte length,
not message text. `--show-content` adds the answer for private inspection.
Both modes remove literal occurrences of the configured token and suppress
raw upstream errors. Do not commit live output without reviewing/redacting
identifiers; content hashes can also correlate sensitive answers.

Exit 0 means correlated completion (including a silent acknowledgement).
Exit 2 includes suspended/unsupported output, invalid config, protocol,
authentication, rate-limit and transport failures. `SIGINT`/`SIGTERM` stops
local waiting; it does **not** cancel Linear's run. Any failure after dispatch
conservatively reports `mayHaveExecuted`; reconcile the recorded IDs before
doing anything else. No usage amount is guessed.

## Verification boundary

Tests exercise injected protocol responses and native fetch against a local
HTTP fixture; localhost injection is test-only, never a CLI destination.
They prove mechanics and secret handling, not remote compatibility.
Account-dependent tests were blocked as recorded in the ledger.
