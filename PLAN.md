# PLAN — rebuild-era milestones

The bar for every milestone: verified against the decompile corpus or Linear's
official docs. Never plausibility.

- **R0 Reset** (done 2026-09-27): swarm-era code archived at tag
  `archive/v0-swarm-era`; coordination apparatus archived to `archive/swarm-era/`;
  docs rewritten small; skills rewritten as `boot`, `ship`, `github`.
- **R1 Pipeline**: one command downloads the latest Linear release, decompiles it
  into `pipeline/corpus/` (gitignored), and refreshes `extracts/` (official MIT
  vendor digest included). The pipeline is a script that runs, not a runbook you
  read. Absorbs `RUNBOOK-decompile.md`.
- **R2 Feature matrix**: `docs/feature-matrix.md` enumerates every Loops feature
  from corpus plus docs. Each row: feature, evidence, status. This becomes the
  acceptance bar for everything after.
- **R3 Skeleton**: fresh `src/` (server, UI shell, connect) per
  `SPECS/target-architecture.md`, built only once the matrix exists.
- **R4+ Rows**: implement matrix rows to exact parity. Release bar: every row
  verified, UI checked against the corpus (issue #20).

Golden-goose research (issue #14) rides R1/R2: the chat-route trace comes out of
the corpus the pipeline produces.
