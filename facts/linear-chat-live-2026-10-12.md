# Linear chat live protocol observations — 2026-10-12

Session `01a13136-96e7-7330-b9ea-3f6952f070d2`, inference lane #316.
Branch `live-linear-chat-probes`, explicitly based on #376 at `24e088e`.
All timestamps below are UTC. This is a measurement log, not an adapter
compatibility or pricing guarantee. **BLOCKED: email-code relay timed out.**

## Setup and decisions

- The requested integration-map path is absent from the main checkout.
  Read the tracked map and experiment ledger on `in-linear-chat-protocol`
  (`24e088e`) before probing. That map has seven sections, not a section 8;
  the owner's explicit E0–E5 list defines this run.
- Main and the earlier agent's worktree are unchanged. This branch uses
  `.worktrees/live-linear-chat-probes` under the repository; scratch is
  `/tmp/linear-live/`, with a deny-all `.gitignore` and private network files.
- The earlier remote login script had exited. A fresh local, headed
  Camoufox context was used; no existing personal browser session or profile
  was imported. The owner-supplied test email was reused (redacted here).
- No paid plan, purchase, external integration, chat, or workflow has been
  created during this run. The only accepted mutation requests an email.

## E0 — token delivery and identity triple

**PARTIAL LIVE observation; authenticated acceptance UNVERIFIED.**

| Time | Observation |
|---|---|
| 17:47:54.069 | Fresh browser displays the Linear login page. |
| 17:48:28.890 | Email form visible, including a Turnstile response input. |
| 17:49:20.549 | Browser's `EmailUserAccountAuthChallenge` receives HTTP 200, `{success:true, authType:"authToken"}`. No GraphQL errors. |
| 17:49:29.806 | Page says a temporary login link was sent; offers manual code entry. |
| 17:50:04.196 | Manual code form visible: input `name="authToken"`, button “Continue with login code”. |

The accepted challenge request used `Linear-Client-Version: 1.81129.0`.
Client-ID was present (redacted). **Set-Cookie names on the challenge response:
none.** This is not the completion/authentication response and does not
contradict session delivery by a later Set-Cookie.
The [redacted response record](../tools/linear-chat-probe/evidence/live-login-challenge-2026-10-12.json)
preserves the actual `loginCodeOnly:false` browser request flag. The Node
helper's code-only request is a separate, unverified projection.

`NEED-CODE` was written to `/tmp/linear-live-status.txt` when the manual
entry step was reached (17:50:00 UTC). The relay watcher checked
`/tmp/linear-live-code.txt` every 30 seconds against a two-hour deadline,
rejecting files older than this request. It reported `CODE-TIMEOUT` at
19:50:53.590 UTC; the final polling sleep accounts for deadline overshoot.
The code file did not exist at final inspection. No completion mutation ran.

Completion Set-Cookie names, userId, userAccountId, organizationId and
authenticated `AiConversationsQuery(first:1)`: **UNVERIFIED**.
At 19:50:59.267 UTC the browser still displayed the manual code-entry form.
The completed GraphQL capture contains exactly one exchange, the successful
email challenge above. There is no observed session token to hand off.
The [final redacted outcome](../tools/linear-chat-probe/evidence/live-outcome-2026-10-12.json)
records the timeout, absent identity, and zero authenticated probe attempts.

## E1 — direct-chat credit behavior

**UNVERIFIED.** No authenticated organization, usage snapshot, usage alerts,
direct-chat send, or post-send snapshot. Missing values are not zero.
No conclusion about whether normal chat consumes usage can be drawn.
Only one direct send is authorized for the isolated A/B comparison; do not
mix a workflow-context send into the direct-chat measurement window.

## E2 / E2b — JSON frames and minimal client fields

**UNVERIFIED.** No authenticated socket has been attempted.
No observed `clientType`, `flagClient`, `cellName` or `clientDatabaseId`.
HTTP version `1.81129.0` above is observed on login; it is not yet an
accepted socket `clientVersion`. The new original socket helper omits all
compression/binary negotiation fields and requires captured values.
Its fixture tests do not establish live handshake or JSON-frame acceptance.

## E3 — token mint and first use

**UNVERIFIED.** No session token observed or verified. An email challenge
acceptance timestamp is not a token mint timestamp. The later completion
response time will bound observation of issuance, not assert an exact
server-side issued-at time. Long-duration TTL checks belong to the orchestrator.

## E4 — workflow-style entity context

**UNVERIFIED; zero sends.** No context or source flag was invented or tried.

## E5 — send-time selection

**UNVERIFIED.** No live send or input introspection. No claim of accepted
`promptPresetKey`, model selection, or workflow-context compatibility.

## Reproducibility and checks

Private artifacts are `network.jsonl` (new-context GraphQL traffic),
`state.json`/`state.png` (latest login observation), `browser.py` (capture
controller), and `wait-code.py` (bounded relay watcher), in the scratch
directory above. They are intentionally not committed. The browser widget
completed verification in the normal page flow; no solver or fabricated
challenge response was used.

Committed original Node helpers: `auth-main.mjs`/`auth.mjs` for one email
challenge or completion exchange, existing `main.mjs` for one send plus
correlated polls, and `socket-main.mjs`/`socket.mjs` for the JSON handshake
experiment. They use only Node builtins. The new minimal auth projections
are fixture-tested, not claimed as live browser-identical operations.

Checks: 35/35 probe tests pass on Node `v22.23.3`;
`git diff --check` and the documentation-link checker pass.
No live inference or streaming acceptance is implied by these checks.
Fresh-clone `bash ci/check-src.sh` at `e14591d`: **PASS**. The available
Homebrew Bash 5.3.20 was used (not macOS Bash 3.2). This source gate does not
exercise live Linear services. The separate probe tests are listed above.
The code head `28e0b8a` also passed the source gate in a fresh clone with
`npm_config_offline=true`, using the previously populated dependency cache.
A redundant online run was stopped during slow toolchain dependency fetches;
that interruption is not a test failure or a passing gate.

## Resume boundary

The browser capture controller is left running at code entry; the two-hour
code watcher has exited. Resuming requires the owner to provide the relay
code and restart the watcher or submit it in that same test browser. A stale
code rejection would require a new normal login challenge, not a bypass.
No existing personal session, guessed token, workspace ID, source flag, or
model preset was substituted. The core usage question remains unanswered.
Draft PR #377 preserves the measured facts and original probe additions;
it is not a claim that E0–E5 or the product adapter are complete.
