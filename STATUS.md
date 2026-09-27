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

- R3.4 UI shell: BUILT then FAILED the exactness audit (docs/audit-2026-09-27.md
  F1/F2: invented tokens + invented IA) — not done; disposition per PLAN.md H
  track: brought to parity-green or archived like v0. The server halves
  (R3.1-R3.3) stand.

Done 2026-09-27 (evening, freeze-era):
- Feedback gate (user directive, #175/#182 merged): NO merges with unaddressed
  CodeRabbit/peer feedback; ruleset enforces review-thread resolution on main;
  AGENTS.md + ship skill carry the rule and the pagination recipe.
- Pipeline route extraction fixed (#174, PR #181 merged): analyze.mjs also scans
  `/:orgKey/…` chunk literals; routes 119 -> 490 unique paths on 1.32.4, incl.
  `/:orgKey/loops/:viewType?`.
- Vault corpus verified COMPLETE at HEAD 6dcc083 (1,550/1,550 pretty chunks; the
  "507 missing" alert on #162 measured a stale local copy — re-clone before
  trusting partial extract numbers; vault fetch = full git clone + count check,
  #187 merged).
- H4 official-docs leg LANDED: per-page live-site digests in
  `extracts/linear-official/docs-site/` (#184, #190 merged; #197 folds in
  #191's remaining pages + the sitemap completeness bar; #186/#191 close with
  credit per the #183 dedupe). KNOWLEDGE §6 now officially sourced (incl.
  HTTP-400 + RATELIMITED exhaustion — constrains PR #155).
- Review-queue burn-down: #169 (KNOWLEDGE §4/§5/§6 corrections + sync-protocol
  supersession), #172 (EXACT-reproduction wording), #173 (merged-PR feedback
  ledger fixes) all merged.

- H1 parity harness P1 MERGED (#171 + #188 + #189; #180 closed superseded):
  `tools/parity` extract+check on the ten fact families, policy tolerances +
  improvements.json, copy+route canaries, `ci/check-ui.sh` (vacuous without
  cargo; CHECK_UI_STRICT=1 opt-in). Extract reproduced by 4 sessions on the
  complete vault corpus: 38 surfaces · 43 routes · 857 copy · 657 edges ·
  137 tokens, canaries 7/7.

Now (the H track — PLAN.md "harness era", the freeze's exit path):
- H1 follow-ups: #177 remainder (routes.json union with #181's enriched
  analyzer output; declaredIn tagging).
- H2 generateTheme exact reimplementation (#168, claimed by sess_01a0e2c0).
- H3 matrix-§A fact extraction for the reference (unassigned).
- H4 remaining: citation rule + docs drift-check step + reviewer two-source
  checklist land in THIS PR (#196, issue #185 §1/§2/§4); PR #197 (docs-site
  fold-in, §3) in review.
- R5.1 dataplane PR #155: needs the 400/RATELIMITED redesign per the docs leg
  (review posted on the PR).

Later: freeze exit per PLAN.md H track -> R4.1 redo (corrected PascalCase
trigger model) -> R4/R5/R6 slices -> matrix rows to exact parity, each gated by
`parity check`.

(Contradiction fixed 2026-09-27: this section previously offered R4.1 as
unassigned work while the freeze banner above forbade feature code.)

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose next steps after the trace (issue #14): E1 live experiment +
minimal sync-reader slice when R6 lands.

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
