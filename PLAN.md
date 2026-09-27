# PLAN: rebuild-era milestones

The bar for every milestone: verified against the decompile corpus or Linear's
official docs. Never plausibility.

## The doctrine: thin slices, perfected as we go

We build slowly and incrementally, on purpose. The first implementation failed by
building breadth before depth, so:

- ONE PR = ONE thin vertical slice, reviewable in minutes. Never a whole layer,
  never the whole stack.
- Foundation slices first (transport, boot, settings): they set the patterns
  every later slice copies, so they get extra care and review while change is
  cheap.
- A slice is done when: the gate passes on a fresh clone, the diff is audited
  against the legal lines, a sibling session has reviewed it when one is around
  (self-merge only when you are verifiably the only session running; while any peer
  session is active there are no self-merges, blocking PRs included — AGENTS.md,
  user directive #154), and STATUS.md plus
  docs/feature-matrix.md are updated in the same PR.
- Code stays small: zero runtime deps, strict TS, boring patterns. If a slice
  feels big, it is two slices.
- Anything touching Linear behavior is verified against the corpus
  (`pipeline/corpus/`, via the vault) and the matrix row is noted.

Done: R0 reset (2026-09-27), R1 pipeline harness + corpus in the vault, R2
feature matrix, R3.1-R3.4 foundation slices (R3.4's UI shell subsequently
failed the exactness audit — see the H track below; the server halves stand).

## R3: foundation slices (the architecture, perfected)

- R3.1 transport: `src/connect` (RFC 6455 framing + JSON-RPC + server mount +
  client + round-trip test).
- R3.2 boot: `src/server` (http + static + environment descriptor + dev token +
  node:sqlite store + health).
- R3.3 settings vertical (server): `settings.*` RPCs + `dataplane.probe`.
  Write-only secrets; probes never hit the network in tests.
- R3.4 UI shell: `src/ui` skeleton (sidebar, routes, theme tokens from
  `docs/ui-reference.md`, empty states) with the Settings page wired to the
  R3.3 RPCs.

## H: the harness era (inserted 2026-09-27 — the freeze's exit path)

The 2026-09-27 audit (docs/audit-2026-09-27.md) froze feature work: the R3.4 UI
shell failed the exactness bar and nothing could PROVE a slice exact. The H
track builds that proof, then restarts the R sequence behind it. Work items:

- H1 parity harness P1 (issue #162, PR #171): `tools/parity` extract+check on
  routes/copy/structure/tokens, wired into `ci/check-ui.sh` (a NEW gate that
  lands with #171 — `ci/check-src.sh` stays untouched; the two red
  independently). Follow-ups: route
  extraction from chunk literals (#174/#177 — PR #181 supplies the enriched
  routes.json) and the reference manifest.
- H2 generateTheme exact reimplementation (issue #168): reproduces Linear's
  runtime theme function so token VALUES are exact by construction; golden
  vectors feed the harness's theme family.
- H3 corpus fact extraction for the matrix §A surfaces (copy, structure, order,
  primitives) so the reference covers what the UI rebuild will be checked
  against.
- H4 official-docs leg (issue #185): live-site digests under
  `extracts/linear-official/docs-site/` + citation rule + docs drift check.
  (The upstream-vendored `docs/*.md` are stubs; never cite them.)

- G track — golden-tier acceptance bar (user directive 2026-09-27, issue
  #220): the extract→compare families demote to drift canaries; the bar
  becomes hand-verified golden tests whose expected values are computed by
  EXECUTING the corpus code (the #215 pattern, generalized). Slices: G0 spec
  rewrite · G1 `tools/corpus-exec` · G2 golden manifests + `parity check`
  golden leg + coverage ledger · G3 generateTheme retrofit (subsumes #218) ·
  G4 first rendered-component golden.

FREEZE EXIT (amended by #220): #171 merged with `parity check` in the gate
(done); #168 merged with golden vectors matching corpus execution (done);
G1+G2 landed; one surface rebuilt end-to-end whose modules carry hand-verified
golden manifests with the golden leg green (the pattern every later slice
copies — `ui-facts.json` alone no longer suffices); the R3.4 shell either
brought to golden-green or archived like v0.

## R4: loops domain slices (post-freeze; trigger model CORRECTED)

Trigger entities are PascalCase model values (`Issue`, `Project`, `Document`,
`Initiative`, `Team`, `Release`, `Cycle`, `Schedule`, `Chat`) — NOT a
`schedule|chat|event` type with a separate event field. The audit's Finding 2
killed the R4.1 PRs (#160/#161) that encoded the wrong model; the redo builds
on `SPECS/loops.md` as corrected by #167/#173.

- R4.1 `loops.list/upsert/publish/setEnabled` + the loops list page (rebuilt
  against `LoopsManagementPage`/`AutomationsList` facts, parity-checked).
- R4.2 loop detail + editor blocks (trigger picker, schedule, conditions,
  prompt).
- R4.3 template library + new-loop prefill.

## R5: dataplane slices (Linear as the data plane)

- R5.1 GraphQL client + rate budget (promote the R3.3 probe).
- R5.2 reads (issues, projects, teams, labels, states) with fixtures.
- R5.3 writes (comment create, issue update) + idempotency + audit.

## R6: engine + runtime slices

- R6.1 scheduler (rrule) + trigger evaluator.
- R6.2 run state machine + turns/parts + streaming (`runs.subscribe` seq/resume).
- R6.3 brain interface + first harness adapter (OpenRouter-compatible).
- R6.4 steer/continue/cancel + elicitations.

## R7: the golden goose (research in parallel; integrate after R6)

- Trace `AiConversationSendMessage` call sites in the corpus (streaming shape,
  auth context), reading only, anytime.
- Live probe with the user's Linear credentials (user-guided).
- If proven: goose brain adapter behind the same Brain interface as the external
  harnesses.

## R8: matrix burn-down

Rows to `built` then `exact`. Release bar: every row verified, UI checked against
the corpus (issue #20) — **computed, not eyeballed**: `tools/parity` (the Rust
parity harness, SPECS/ui-parity.md) turns the corpus into the reference and every
UI PR carries its `parity check` report.
