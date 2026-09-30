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
6. The differential probe (reviewer recipe for kernel PRs, #295 2026-09-29):
   when feedback asks "does the module match the corpus on inputs the golden
   does not pin?" (coverage requests, suspected edge divergence), do not
   round-trip to the author — settle it yourself in minutes. Write a
   throwaway drive-mode case against the REAL corpus export (reuse the PR's
   own stub + a small driver; `corpus-exec run`, never committed), run the
   SAME fixtures through the PR's clean module, and diff:
   - MATCH ⇒ post the probe evidence on the PR; the thread is addressed
     (decline-with-evidence). The author may fold the case into the golden
     but does not have to.
   - DIVERGENCE ⇒ a red: block the merge, and the probe case graduates into
     the author's golden.
   Probes are cheap because only the CLEAN MODULE is under test — the
   corpus-side output needs no hand-verification or commit. This tests
   behavior the author never thought to pin, which reading the diff cannot.
   Two boundaries, both binding:
   - The probe executes PR-CONTROLLED code (the PR's stub + clean module)
     plus corpus code in-process; corpus-exec's temp-dir copy is NOT a
     security sandbox. Run probes only in the same disposable fresh-clone
     environment you already use for gate runs — never in a shell holding
     credentials or tokens — and read the PR's stub/driver diff before
     executing it, exactly as you would before running its tests.
   - Probe evidence posted on the PR is PUBLIC. Post fixture shapes, the
     clean module's output, and a match/diverge verdict with a minimal
     diff excerpt — never raw corpus code or bulk corpus output (the
     legal line: extracted facts and executed VALUES are fine, Linear's
     code is not).
7. The citation audit (reviewer recipe for TRANSCRIPTION/ASSEMBLY PRs,
   #295 2026-09-30): kernel probes (step 6) presume an executable corpus
   counterpart. A transcription or assembly PR (a shard doc, an A-track view
   shell, any diff whose acceptance bar is the transcription rule + seam rule)
   ships cited STRUCTURE instead — so its review is a citation audit:
   - Census: extract every string literal, className token, copy string, and
     structural claim from the diff (grep-grade; the same census
     `ci/check-ui.sh` will eventually automate for UI slices).
   - Dereference each citation. Value-laden strings ONLY against the RAW
     tree or corpus-executed output, never `pretty/` — the prettifier
     rewrites template-literal interiors, so a pretty-tree check can
     confirm a byte-wrong string (proof case: `labelForTeams`'s
     `+ ${n-3}` no-space byte fact, PR #307). `pretty/` remains fine for
     structure and identifiers.
   - Bucket every uncited literal: seam-list / data-gap region / VIOLATION.
     A violation is a red verdict regardless of plausibility — plausibility
     was R3.4's failure smell, not its defense.
   - Derived-pinned structural claims ("this branch behaves like that one")
     need the author's probe-before-ship record where an executable
     counterpart exists, or a raw-tree re-cite where none does. "Derived
     from adjacent structure" is not a citation (the #307 flat-leg
     divergence measured this failure mode at >=1 per PR carrying one).
   - Verdicts are evidence-shaped: "N/N literals cited, K seam, M gap,
     0 violations" — not taste-shaped. Worked example: the #311 merged
     review.
8. Reviewer evidence checklist (issue #185 §4, binding): a claim about Linear
   behavior verified against only ONE evidence leg when both cover it is a
   review finding. Corpus = what the client does; official docs
   (`extracts/linear-official/docs-site/`) = what the public API guarantees.
   Check citations exist and point at citable sources — the upstream
   `extracts/linear-official/docs/*.md` stubs are never citable (AGENTS.md
   hard rule).
9. Merge method: squash via `github.merge_pull_request`. `main` is PR-only for
   everyone (ruleset `main-pr-only`): no direct pushes, no force pushes.
10. Update `STATUS.md` in the same PR whenever the board changes.

Legal audit before every merge: no Linear proprietary material anywhere in the
diff. The repo is public; this line is absolute.
