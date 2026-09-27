# STATUS: the board

Updated in the same PR as the work it describes. If this file and an issue
disagree, the issue is fresher; fix this file.

**Phase: R3 (skeleton). FREEZE (2026-09-27, user directive issue #157): no new
UI/server feature code until the audit (docs/audit-2026-09-27.md) is digested
and the CLI parity harness is planned. Safe work: audits, corpus extraction,
docs corrections, the generateTheme reimplementation, harness planning.**

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
- Official-docs gap closed (2026-09-27): the vendored upstream `docs/*.md` turned
  out to be one-line stubs — the real docs moved to linear.app/developers. Fact
  digests of the live pages (rate limiting incl. RATELIMITED-on-400 + all budget
  headers, GraphQL auth-header shapes, pagination/filtering, webhooks contract +
  HMAC verification, OAuth token lifecycle) now live in
  `extracts/linear-official/docs-site/`; KNOWLEDGE §6 rewritten from them; the
  audit's UNVERIFIED flag on `src/server/linear.ts` rate headers resolved.
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

Now:
- R4.1 loops domain slice (unassigned): loops.list/upsert/publish/setEnabled
  over the store + the loops list page wired live. src/model gains loop.ts.

Later: R3.3+ foundation/domain slices per PLAN.md -> R4 matrix rows to exact parity.

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose next steps after the trace (issue #14): E1 live experiment +
minimal sync-reader slice when R6 lands.

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
