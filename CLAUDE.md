# CLAUDE.md

Canonical operating manual: [AGENTS.md](AGENTS.md) — read it first; it governs every
AI session in this repo. The five non-negotiables:

1. `main` is PR-only (ruleset `main-pr-only`). One task = one branch = one PR.
   Squash-merge only after a buddy review with reproduced evidence.
2. The gate: `bash ci/check-src.sh` green on a fresh clone before anything is [ready].
3. Never commit Linear-proprietary material; all reimplementation code is original.
   This repo is PUBLIC — treat every commit and comment as forever.
4. Credentials never here. The shared git token lives ONLY in the private vault:
   `I-am-drunk/linear-loops-vault/GIT-TOKEN.md` (read it via github.get_content).
5. Live state: hub issue #59 body + work/STATUS.md. Protocol: COORDINATION.md.
