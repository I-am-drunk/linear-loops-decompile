# Linear chat experiments — 2026-10-12

Session `01a130e0-be7f-7d91-bde7-a6d57de254a7`, IN #316.
Companion: [integration map](linear-chat-integration-map.md).
No authenticated protocol experiment completed. No account, credential,
conversation, subscription, charge or workspace was created by this session.

## Actual preparation and blocker

At approximately 16:12–16:15 UTC, browser initialization failed with
`Importing module "node:process" is not allowed in node_repl`.
Computer Use worked as the fallback. A new Chrome tab opened
`https://linear.app/signup`, showing “Create your workspace” and Google,
email and SAML options. Clicking “Continue with email” showed
“What’s your email address?” and an empty email field.

No experiment-only inbox or verification-code access was provisioned.
Existing personal browser accounts were not used, and no email was submitted.
Creating an account through this Computer Use surface also requires a
separate action-time confirmation; the autonomous run did not have one.
These are account-setup blockers, **not** evidence that Linear refuses free
accounts, chat, workflow sources, or JSON frames. Signup UI observation is
LIVE; every authenticated result below is **UNVERIFIED**.

The source investigation did proceed: the September pilot chunks were
re-fetched using curl, and selected October entry-linked chunks were inspected.
An initial Python HTTP fetch returned 403; curl succeeded. This was not an
authenticated endpoint rejection. Source hashes/locators are recorded in
`tools/linear-chat-probe/evidence/sources.json`; no vendor files are committed.

## E1 — credit diff

Result: **UNVERIFIED**. Before/direct/after-workflow snapshots are all absent,
not zero. There is no observation of free inference or a charged amount.
Future repro (only a new experiment workspace, no paid upgrade/top-up):

1. Complete browser signup with an experiment-only inbox and required
   confirmation. Record UTC time, plan/trial, entitlements and client build;
   disconnect other integrations and ensure no concurrent work.
2. In browser network tools, capture the visible Usage and Loop Limits page
   reads: operation/variables, current credits/allowance, period bounds and
   refresh time. Include `usageSummary` buckets (`feature`, `amountUsd`),
   `dataEnd`, and `usageLimitSpend` subject/current/previous-window totals if
   exposed. Use the account's actual range/subject/period values, not guesses.
   These operations are sourced in S11 of the map.
3. Snapshot A after two stable reads. Send exactly one harmless direct chat:
   “Reply with CHAT-PROBE-OK only. Do not use tools or modify anything.”
   Record returned IDs, actual stored `initialSource`, final status/parts,
   and all billing/usage error metadata, with identities redacted.
4. Wait for usage `dataEnd` to cover the run and take stable snapshot B using
   identical variables. Without this midpoint, two sends cannot isolate the
   direct-chat delta.
5. Create one manual-only workflow in that workspace with the same prompt
   and no integrations. Trigger it once using the UI; capture the actual
   creation request and stored `initialSource:workflow`. Do not assume this is
   an `AiConversationSendMessage` call. Snapshot C after the same settle rule.
6. Report B−A and C−B by feature/subject, balance and allowance, preserving
   rounding and the measurement window. If aggregation is delayed, permission
   denied, access gated, or values unchanged only at coarse precision, report
   “no observable delta in this window,” not “free.” Record a bounded wait
   (proposed 15 minutes, re-read every 30 seconds), then stop as inconclusive.

## Handshake acceptance

Result: **UNVERIFIED**; no token, account IDs, authenticated socket or frames.
Concrete `cellName`, `clientDatabaseId`, HTTP client ID, `clientType`,
`flagClient` and `clientVersion`: all **UNVERIFIED**.
Protocol version 3 is source-verified, not negotiated in this session.

Future repro: capture a successful UI handshake first, locally and privately.
Keep the account's real values; pseudonymize them only in published evidence.
Do not use example dictionary values as actual region/database identifiers.

Using a local Node WebSocket test harness, connect to
`wss://sync.linear.app?userId=<captured>&userAccountId=<captured>`.
Send the map's `hshk` JSON with captured values, omitting
`useBinaryProtocol`, `compressionDictionaryVersion` and the URL's
`syncCompression`. Observe for at most 30 seconds. Record upgrade status,
frame kind, decoded command, close code/reason, and whether server `hshk.sync`
arrives. Do not publish cookies or authorization bytes.
Subscribe to the created conversation's `parts` only after handshake success;
record whether text `streamData` frames follow. A JSON handshake followed by
binary data is **not** plain-JSON acceptance. Failure without session cookies
does not isolate framing from authentication. Repeat once with the same
authorized browser-session transport if its cookie requirement is established.
No standalone socket experiment code is claimed as delivered by the poll probe.

## Workflow-source acceptance

Result: **UNVERIFIED**; neither a workflow run nor a source-flag mutation ran.
The inspected normal send hook does not set `initialSource`. The workflow
launcher instead persists a workflow-linked model (S2/S10).

Future repro: first observe E1's one genuine UI workflow launch; save its
redacted operation/variables and resulting source/links. Inspect the permitted
client schema or captured input shape before proposing a source-flag send.
If the private input actually declares `initialSource`, send one additional
harmless message with `workflow` and record both GraphQL acceptance and the
stored source. If not declared, record the validation failure or schema
absence instead of inventing a request. This extra message is outside E1's
A/B/C window. A successful launch does not prove source-flag send support.

## Token birth, lifetime and refresh

Result: **UNVERIFIED**; authenticated observation duration **0 seconds**.
No expiry timestamp, successful token-only call, refresh, rotation, expiry
failure or revocation was observed. The email OTP is not a session credential.

Future repro: during the sacrificial login inspect request/response headers
and cookie attributes locally using supported browser network tools. Record
where the credential is first issued and whether `authenticationToken` is
actually present. Do not read existing personal profiles or session stores.

If an exportable token is issued, keep it only in a chmod-600 ignored local
file. Compare safe read requests with/without the token and session cookies,
holding identity headers constant. Then observe read-only calls at 0, 5,
15, 30 and 60 minutes; at a declared expiry boundary if available; and on a
later resumed session. Record issuance/last-success/first-failure timestamps,
renewal requests and whether the credential changed, never its bytes.
One hour of success establishes only a one-hour lower bound.
Do not call public `/oauth/token` as a guessed browser-session refresh.
After separately authorized sign-out/revocation, compare safe read behavior;
distinguish an explicit revocation from expiry and a network error.

## Probe evidence and remaining acceptance

`tools/linear-chat-probe/evidence/dry-run.json` records an offline request plan
with fictional IDs and a redacted authorization value. It is **not** a live
send result. The candidate poll projection and `id.eq` filter need acceptance;
the script preflights them before the single mutation. The source query only
selects IDs and hydrates elsewhere, so source inspection alone cannot close
this gap. See the probe README for required inputs and commands.

Local automated tests cover one-send behavior, auth/schema failures, response
correlation, suspension, malformed/oversized bodies, deadlines, cancellation
of local waiting, redaction and offline planning. They do not prove Linear
compatibility, billing behavior, token lifetime or socket acceptance.

Stop conditions for a future run: paid upgrade required, CAPTCHA, required
confirmation unavailable, missing experiment inbox, disallowed credential
export or provider entitlement refusal. Record the blocked step and preserve
the result as UNVERIFIED; do not use an existing personal/work workspace.
