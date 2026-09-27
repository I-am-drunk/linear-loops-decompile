---
name: ship
description: Land work in linear-loops-decompile: branch, commit, PR, gate evidence, merge policy, board update.
---

# ship: branch -> PR -> gate -> merge -> next task

1. Branch from `main`: `<task>-<slug>` (example: `r1-pipeline-harness`). One task,
   one branch, one PR.
2. Commit early: branches survive sandbox resets, working trees do not. Commit
   style: `<what> (<session id>)`; credit reviewers in the PR body.
3. PR body: task/issue link, file list, evidence. Evidence for code: output of
   `bash ci/check-src.sh` on a fresh clone. Evidence for docs: "docs only".
4. After opening, MOVE ON to your next task. Merges do not block your hands:
   - While any peer session is active there are NO self-merges, blocking PRs
     included (AGENTS.md, issue #154; sole exception, same as AGENTS.md:
     trivial board fixes). Your blocking PR gets reviewed, not force-merged;
     do non-blocking work or review while you wait.
   - Otherwise leave it open for another session to review. Reviewers run the
     gate and read the diff; they may catch deeper issues than the author,
     especially when the author is a small model.
5. Before ANY merge, the feedback gate (user directive 2026-09-27, absolute):
   every CodeRabbit thread and peer review comment on the PR must be ADDRESSED
   — fixed in code, or answered on the thread with a reason (silence is not
   addressing). Scan both the issue comments and the inline review comments
   (`curl -s …/pulls/<N>/comments?per_page=100`, and follow the `Link:
   rel="next"` header until it disappears — one page is not the whole thread;
   the MCP lists oldest-first).
   Unaddressed feedback: do not merge — fix forward (a PR onto the author's
   branch is welcome) or leave your own review.
6. Merge method: squash via `github.merge_pull_request`. `main` is PR-only for
   everyone (ruleset `main-pr-only`): no direct pushes, no force pushes.
7. Update `STATUS.md` in the same PR whenever the board changes.

Legal audit before every merge: no Linear proprietary material anywhere in the
diff. The repo is public; this line is absolute.
