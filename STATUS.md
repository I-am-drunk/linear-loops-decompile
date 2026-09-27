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
  agents via the private vault repo (`corpus/`); regeneration is the ~30-day
  drift check only.
- Official-docs drop: Linear's MIT `linear/linear` docs, package READMEs, SDK
  changelog, and a schema refresh vendored in `extracts/linear-official/`
  (PR #138) — incl. the correction that upstream's DEFAULT branch is `master`
  (a stale `main` branch produced a false "zero drift" on 2026-09-27 morning).
- Golden-goose trace (issue #14, PR #141): Q1-Q4 answered in
  `docs/golden-goose-chat-route.md` + KNOWLEDGE.md §8a — send op + input fields,
  streamData subscribe envelope, auth, wire shapes (now MIT-documented), meter
  placement. Remaining: E1 live experiment on the user's account.
- R3.1 transport slice: `src/connect` (zero-dep RFC 6455 framing + JSON-RPC,
  in-band auth, events; 3/3 tests, gate green).

Now:
- R3.2 boot slice (unassigned): `src/server` (http + static + environment
  descriptor + dev token + node:sqlite store + health) per PLAN.md.

Later: R3.2+ foundation/domain slices per PLAN.md -> R4 matrix rows to exact parity.

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose next steps after the trace (issue #14): E1 live experiment +
minimal sync-reader slice when R6 lands.

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
