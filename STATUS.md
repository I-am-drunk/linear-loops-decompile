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

Now:
- R3.1 transport slice (in progress: sess_01a0e2c0-4c63-70a3-a057-cc1ded6f0665):
  src/connect per PLAN.md. We build in thin vertical slices, one PR each.

Later: R2 feature matrix -> R3 skeleton -> R4 matrix rows.

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose chat-route trace (issue #14).

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
