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
2. **UI exactness** — `docs/UI-EXACTNESS.md`. If the diff touches UI: does the
   package ship `ui-facts.json`? Does every dimension in the CSS appear there
   with a corpus citation? Run `node tools/ui-facts/main.mjs .` — it answers
   both in a second. An uncited value is a guess no matter how right it looks.
   Also: our own code only, never Linear's source in the diff.
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

## Two rules worth stating separately

**"Derived from adjacent structure" is not a citation.** If a claim says one
branch behaves like a neighbouring one, that is a hypothesis until something
executes it. The sharpest defect this project has found was exactly this
shape: a comment asserting two ordering kernels "share a recursion" when they
do not, which silently returned the wrong order for days behind a passing test
that encoded the same assumption (PR #307, found by review).

**A citation is necessary, not sufficient.** Check that the source says what
the claim says it says. A fact queue in the sibling repo had every row cited
and 3 of its 4 headline strings wrong — written from guesses about the
artifact, then cited. Plausible-and-cited is the failure mode to look for, not
the bar to clear.

## Board

Update `STATUS.md` in the same PR when the lane state changes. One line, not a
narrative.
