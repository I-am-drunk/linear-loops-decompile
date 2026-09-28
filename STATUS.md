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
  F1/F2: invented tokens + invented IA); ARCHIVED 2026-09-28 per #200 (claim +
  two peer concurrences; tag `archive/r3.4-ui-shell` = pre-delete main
  277bbf3). `src/ui` deleted; ci/check-ui.sh passes vacuously until the first
  golden-verified UI slice ships WITH ui-facts.json. The server halves
  (R3.1-R3.3) stand; the R3.3 Settings RPC layer survives untouched.

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

USER DIRECTIVE 2026-09-27 (late, issue #220): the parity compare-DNA is
corrected. Grammar-extracted set-compare (routes/copy/…/states) DEMOTES to
drift-canary tier; the ACCEPTANCE bar is now hand-verified golden tests
computed by executing the corpus code (#215 pattern, generalized). Plan-of-
record: #220 (G0 spec claimed by sess_01a0e4cb-0cdc-7797-b503-a67080b81c96;
G1 corpus-exec LANDED 2026-09-28 (#230+#233+#234 squashed to main `78a9f69`:
run/verify + invoke/render modes, RAW `corpus/client` as the executable
authority with source-flavor provenance, injective serializer — Date/undefined/
key preserved, non-plain objects a loud typed error; 27/27 incl. the raw-tree
corpus smoke, six reviewer verifications), G2 coverage ledger LANDED 2026-09-28
(#237: tools/coverage — matrix x corpus-manifests x goldens ->
golden|improvement|GAP per surface + off-matrix table; corpus-free `coverage
check` wired as a never-vacuous ci/check-ui.sh leg; ui-theme reference
manifest), G3 theme retrofit (claimed sess_01a0e4ca-cd60), G4 first
rendered-component golden LANDED 2026-09-28 (src/ui-loops-icons:
AgentAutomationEmptyStateIcon darkDefault — corpus-executed, hand-verified vs
source, serializer-v2 bytes, TZ/locale-invariant; the pattern every rendered
slice copies) with its CLEAN REIMPLEMENTATION landed the same day (pure
theme->host-element-tree module, byte-matches the golden through the
tagged-v2 serializer as the declared observation driver; corpus-manifest joins
the G2 ledger: first golden-backed chunk on the meter, 78 chunks · 1 golden ·
77 GAP; lightDefault pair case added same day — the pair pins token flow). G5
second golden-backed chunk LANDED 2026-09-28 (AutomationsEmptyStateIcon,
same matrix row: render-tier via the G1 micro-dispatcher — useReducedMotion
stubbed false, static branch only, the isAnimated gradient branch explicitly
out of scope until the T2 renderer — darkDefault+lightDefault golden pair +
clean reimplementation; meter: 78 chunks · 2 golden · 76 GAP). H3 family expansion
beyond what is merged is ON HOLD; #218 reframes as G3.

Now (the H track — PLAN.md "harness era", the freeze's exit path):
- #231 pipeline execution-integrity guard LANDED 2026-09-28 (#232 + #239
  fix-forward squashed to main `6b5854c`, closes #231): prettify output is
  gated on parse + FULL token-stream signature vs raw (subsumes the template
  check; zero false positives measured on all 1,541 prettifiable chunks);
  cached raw fallbacks are byte-verified pre-UTF-8-decode. Real-corpus rebuild:
  1,541 prettified + 9 byte-exact raw fallbacks, 0 failures, --check
  1,550/1,550. Follow-up: #241 (Tier-2 extract-drift contract for analyze.mjs
  — the 9 raw fallbacks move ops/models counts; carved out of the #232 review).
- #241 extract-drift contract LANDED: analyze.mjs grammars are now
  layout-invariant (tree contract documented in the header; drift test
  `pipeline/analyze.test.mjs` wired into `npm test`). Finding: the old
  fixed-layout grammars UNDERCOUNTED the same corpus — real 1.32.4 numbers are
  **376 ops / 136 models (all with fields)** (was 258/87: beautifier-injected
  newlines inside template literals hid 49 model registrations; literal-pairing
  desync on escaped newlines dropped 118 ops). Anchored grammar cross-checked
  exactly against the raw minified tree (376 = 376, 136 = 136).
  extracts/{models,graphql-ops}.md regenerated; vault analysis/*.json
  re-baseline PENDING (post-merge vault push, noted on #241).
- G1 serializer v2 LANDED 2026-09-28 (#240 squashed to main `4a909fd`, closes
  #238): the golden serializer is a closed tagged JSON grammar
  (`corpus-exec-tagged-json-v2`) — every v1 collision pair (null≡undefined,
  0≡-0, Date≡string, sparse holes, …) now yields distinct bytes; loud,
  path-naming refusal outside the grammar; own-key order preserved. G2 goldens
  build on v2 bytes.
- H1 follow-ups: #177 closed (routes.json union + `?` params landed via
  #171/#189/#181). declaredIn route tagging LANDED (#208
  closed; #211 merged — 43 routeMeta entries, roles verified); extract
  integrity guards LANDED (#205 closed; #210+#214 merged).
- H2 generateTheme exact reimplementation (#168): `src/ui-theme/` —
  generateTheme + LCh/APCA color math + the object-hash input hash, verified
  byte-for-byte against golden vectors executed FROM the corpus generator
  (4 parametrizations × both retina branches × 116 tokens + 18 shell values +
  derived elevated/sub/menu/selected/focus/sidebar themes + dynamic functions
  + LCH/P3 formats; 13/13 tests). Harness wiring LANDED (#218): golden vectors become
  `theme.values.*` reference surfaces (8 × 133 = 1,064 exact value facts on
  1.32.4), `value:` canaries pin the wiring + theme drift.
- H3 matrix-§A fact extraction (plan-of-record now issue #213; #207 closed
  as duplicate): H3.1 order family SHIPPED via #212 (two corpus-proven
  grammars, 2 chains on 1.32.4); states family SHIPPED via #217
  (ternary-alternate grammar, states canaries); primitive family SHIPPED via
  #229 (pageMetadata-export/role:dialog signals, 8 primitives on 1.32.4 —
  drift-canary tier per the #220 pivot); behavior/bindings/icons ON HOLD per
  the pivot.
- H4 DONE (issue #185, closed): docs-site digests complete to the 26-page
  sitemap bar (#184/#190/#197 merged); citation hard rule + docs drift-check
  leg + reviewer two-source checklist merged (#196); agent-signals +
  best-practices prose digests merged (#201).
- R5.1 dataplane PR #155: the blocking 400/RATELIMITED finding and the
  markExhausted/Retry-After gate bug are fixed on its branch (#202/#204
  merged into it; server 26/26). Stays open per the #157 freeze.

Product contract clarification (2026-09-28, owner directive): the rebuild is an
original **Loops-only** product. The sidebar contains Loops, only the Loops-required
views (such as Runs/Templates as built), and our Settings—not Linear tracker navigation
or Linear Settings. The connected account's PAT/OAuth is the documented data-plane
connection for reads/write-back. The golden goose is a separately managed user-session
bridge to normal Linear chat and remains the primary brain; external inference is
fallback-only. This changes scope wording and architecture, not the EXACT UI/behavior
bar for the Loops surfaces or the public-code legal line. Binding detail:
`SPECS/product-contract.md`; boot-level rule: `AGENTS.md`.

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
