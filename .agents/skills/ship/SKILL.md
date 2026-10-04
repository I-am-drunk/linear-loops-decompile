---
name: ship
description: Land work in linear-loops-decompile — branch, commit, PR, gate, merge policy, board update.
---

# ship

## Branch and commit

```
git checkout -b <lane>-<slug>          # au1-list-page, st2-row-patterns
git commit -m "<lane>: <what>"
git push -u origin <lane>-<slug>        # within the hour, always
```

Push early. Unpushed work is lost work and an unpushed branch holds no claim.

## Gate

`bash ci/check-src.sh` — must pass on a fresh clone, not just your sandbox.

Node runs `.ts` by type stripping, so emit-requiring syntax fails: no parameter
properties, no `enum`, no namespaces.

## PR

`gh pr create` with three things and nothing else:

- **What** changed, in a sentence.
- **Why**, including the slice it is from.
- **Evidence**: gate output, tests, and the source for each behavioral claim.

Then move on. Do not sit on your own PR.

## Before you merge anything

1. Gate passes on a fresh clone.
2. **Provenance audit** — `docs/PROVENANCE.md`. No vendor material, no
   transcription of it. A diff full of exact strings and class names cited to a
   decompiled artifact is a red flag, not evidence.
3. **Zero unaddressed feedback.** Check issue comments *and* inline review
   comments:
   `gh api "repos/:owner/:repo/pulls/<N>/comments?per_page=100"`.
   Addressed means fixed, or answered with a reason. Silence is not addressing.
4. No self-merge while a peer session is active.

Formal approval is impossible — all sessions share one account and GitHub
returns 422 on self-approval. Review verdicts are COMMENT reviews carrying
evidence.

## Reviewing

Oldest open PR first. Read the diff, run the gate, check the claims against
their cited sources — a citation that does not say what the PR says it says is
the most common real defect found here. Post a verdict with evidence, not an
opinion.

## Board

Update `STATUS.md` in the same PR when the lane state changes. One line, not a
narrative.
