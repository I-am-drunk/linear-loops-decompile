# STATUS: the board

Updated in the same PR as the work it describes. If this file and an issue
disagree, the issue is fresher; fix this file.

**Phase: R3 (skeleton).**

Done 2026-09-27:
- Archive: all swarm-era code preserved at tag `archive/v0-swarm-era`; PRs
  #124/#129/#131/#133 closed unmerged (branches kept); coordination docs moved to
  `archive/swarm-era/`.
- Golden goose corrected (issue #14): the prize is Linear's normal AI chat route,
  not the Agent Sessions API.
- R0 docs reset: README, AGENTS, PLAN, this board; skills rewritten as
  `boot`, `ship`, `github`.
- R1 pipeline: `bash pipeline/run.sh` runs end to end (Linear v1.32.4: 1,550
  chunks, 258 GraphQL ops, 87 models, zero drift vs baseline). Corpus ships to
  drift check only.
- Official-docs drop: Linear's MIT `linear/linear` docs, package READMEs, SDK
  changelog, and a schema refresh vendored in `extracts/linear-official/`
  (PR #138) — incl. the correction that upstream's DEFAULT branch is `master`
  (a stale `main` branch produced a false "zero drift" on 2026-09-27 morning).
- Golden-goose trace (issue #14, PR #141): Q1-Q4 answered in
  `docs/golden-goose-chat-route.md` + KNOWLEDGE.md §8a — send op + input fields,
  streamData subscribe envelope, auth, wire shapes (now MIT-documented), meter
  placement. Remaining: E1 live experiment on the user's account.
- R2 feature matrix: `docs/feature-matrix.md` enumerates every Loops feature with
  corpus evidence; KNOWLEDGE.md gained §8 (chat substrate: loop chat IS normal
  chat; zero GraphQL subscriptions, streaming rides the sync queue).

- R3.1 transport slice: `src/connect` (zero-dep RFC 6455 framing + JSON-RPC,
  in-band auth, events; 3/3 tests, gate green).
- R3.2 boot slice: `src/server` (http + static + descriptor + persisted session
  token + node:sqlite store + append-only audit; 4/4 tests + real boot smoke).

- R3.3 settings vertical (server half): settings.get/setLinear/clearLinear/
  setInference/deleteInference/testInference + dataplane.probe. Write-only
  secrets, credential-header refusal, duplicate-name rejection; 8/8 server
  tests with an injected fake fetch.

- R3.4 UI shell: `src/ui` (Vite + React 19, hand-rolled router, theme tokens
  from the corpus via docs/ui-reference.md) with the Settings page wired to the
  R3.3 RPCs. Gate: tsc + vite build; serve smoke through the real server.

- R5.1 dataplane client: `src/server/linear-client.ts` — one GraphQL code
  path for api.linear.app with a header-driven rate budget (gate before
  firing on an exhausted window, 429/Retry-After + RATELIMITED mapping, FIFO
  concurrency cap; budgets never hardcoded — headers are the truth).
  probeLinear promoted onto it; new read-only `dataplane.rateBudget` RPC.
  Queued requests re-read credentials at dispatch, honoring replacement or
  removal while waiting; both paths have deterministic fake-fetch regressions.
  Header semantics verified against Linear's official docs (KNOWLEDGE §6);
  9 client tests + 1 RPC test, all fake-fetch. (Pulled ahead of R4: R4.1's
  page waited on the R3.4 shell; this slice is server-only, was unblocked.)
  Follow-up: RATELIMITED retry delays use the response's exhausted windows,
  including endpoint/complexity resets, with seven regression cases and a
  delayed-body credential-swap check. HTTP 429 fallbacks and preflight failures
  now use the same exhausted-window calculation: simultaneous exhaustion waits
  for the latest reset, and missing/expired endpoint resets do not borrow a
  healthy global window. Nine additional fake-fetch regressions cover this.
  Complexity-limited 429s also backfill missing/expired resets from Retry-After
  so preflight blocks until that delay expires. Three fake-fetch cases cover
  missing, expired, and preserved future resets, including gate reopening.
  Simultaneously exhausted request windows now receive the same Retry-After
  backfill even when an endpoint or complexity window is exhausted too. Six
  fake-fetch cases cover missing/expired request resets and future-reset
  preservation, including refusal after the other window resets and reopening.

Now:
- R4.1 loops domain slice: server half claimed by sess_01a0e392-f0c2-7545-
  b2f2-2c2c875485f3 (issue #150; two later duplicate claims #151/#152 should
  move on per AGENTS.md earliest-keeps-it). loops.list/upsert/publish/
  setEnabled over the store + the loops list page wired live;
  src/model gains loop.ts. Next unassigned: R4.2 loop detail + editor blocks.

Later: R3.3+ foundation/domain slices per PLAN.md -> R4 matrix rows to exact parity.

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose next steps after the trace (issue #14): E1 live experiment +
minimal sync-reader slice when R6 lands.

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
