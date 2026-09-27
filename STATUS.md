# STATUS — the board

Updated in the same PR as the work it describes. If this file and an issue
disagree, the issue is fresher; fix this file.

**Phase: R1 (pipeline harness).**

Done 2026-09-27:
- Archive: all swarm-era code preserved at tag `archive/v0-swarm-era`; PRs
  #124/#129/#131/#133 closed unmerged (branches kept); coordination docs moved to
  `archive/swarm-era/`.
- Golden goose corrected (issue #14): the prize is Linear's normal AI chat route,
  not the Agent Sessions API.
- R0 docs reset: README, AGENTS, PLAN, this board; skills rewritten as
  `boot`, `ship`, `github`.

Now:
- R1 pipeline harness (in progress: sess_01a0e2c0-4c63-70a3-a057-cc1ded6f0665):
  one command that downloads the latest Linear release, decompiles into
  `pipeline/corpus/` (gitignored), and refreshes `extracts/`. The scripts existed
  but were never run; this lands the layout fix plus the first real run.

Later: R2 feature matrix -> R3 skeleton -> R4 matrix rows.

Standing work, always valid: review open PRs (AGENTS.md); UI parity bar (issue
#20); golden-goose chat-route trace (issue #14).

Infra note: GitHub Actions is billing-locked; the gate runs locally:
`bash ci/check-src.sh`.
