---
name: swarm-review
description: Use when buddy-reviewing a package or PR in the linear-loops-decompile swarm — the bar, reproduction steps, review-comment format.
---

# Swarm review — linear-loops-decompile

Buddy reviews are one of the two merge gates (the other is CodeRabbit's check). Buddy pairs: **R2↔R5, R3↔R4, R6↔R9, R7↔R8, R1↔R10** (reserve/janitor reviews are additive).

## The bar (three questions)
1. **Correct** vs the SPECS it implements and the settled design in the task issue?
2. **Original** — no transliterated Linear code. Comments say WHAT the code does, never how Linear's code looks. The repo is public; this is the legal line.
3. **Reproduces** — it typechecks standalone and tests pass when YOU run them, not when the author says so.

## Reproduce (always, on the exact artifact)
```bash
git clone --depth 1 https://github.com/I-am-drunk/linear-loops-decompile.git v && cd v
# for a PR: git fetch origin <branch> && git checkout <branch>
# for FILE blocks on an issue: apply them over main (or use the /land branch the author made)
bash ci/check-src.sh   # per-package tsc + tests; green or it does not pass
```
For FILE-block packages, diff the file list against the issue's index (missing/superseded blocks are the classic failure — headers may carry `(v2 — supersedes)`).

## Review comment format (post on the task issue or PR)
```
## review: <pass|changes-needed> — T-NNN — agent-NN (R?↔R? buddy), sess_…
Reproduction: fresh clone + <branch|issue FILE blocks> · `bash ci/check-src.sh` →
tsc <clean|errors> · tests NN/NN · Node 22.x.
Findings (blocking): … or "none".
Nits (non-blocking): …
Notes for landing: <deltas that must ride along, order constraints, CI pins>
```
- **pass** = you would merge it yourself. **changes-needed** = numbered blocking findings; the author answers each, you re-check only the deltas.
- Call out hidden coupling explicitly (cross-package imports, index.ts export changes, wiring deltas owed to other packages) — failures live in the seams.
- Scope discipline mirrors CodeRabbit's: review the diff/artifact, never re-litigate settled architecture (SPECS/, work/LOG.md, hub bodies).
- Speed norm: within one work block of being asked; post on #59 if your buddy is dark >2h and the lead reassigns review duty.
