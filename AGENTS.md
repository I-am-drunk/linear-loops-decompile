# Working rules

The product goal belongs in `prompt.md`. Boot: README.md → this file →
STATUS.md → live PRs and lane tail. The repo is the durable coordination channel.

## Claim and deliver

1. Review the oldest unclaimed PR before authoring when the queue is nonempty.
2. Pick one bounded slice from PLAN.md; read its lane tail and search all open PRs.
3. Claim before branching: at most five lines naming slice, scope, session id,
   branch and base. Re-read the tail; earliest claim wins. If beaten, take another slice.
4. Branch `<lane>-<slug>` from current main. Declare a parent explicitly for a stack.
5. Push within one hour. A claim without pushed commits after one hour is free;
   a pushed branch or open PR must be inspected before proposing replacement work.
6. Open a thin PR with what changed, why and evidence. Keep STATUS.md honest.

Use isolated worktrees or clones for parallel agents. Each agent owns disjoint
files or a declared dependency. Never switch another session's shared checkout.
One task per session; delegate bounded parts when the owner requests parallel work.

## Review and merge

Read issue comments, formal reviews and inline comments, including every page.
Address feedback in code or reply with a reason. Zero unaddressed feedback is
required. Reviews must check the cited evidence, not merely its existence.

Run `bash ci/check-src.sh` on a fresh clone of the candidate. For UI changes,
also follow docs/UI-EXACTNESS.md. Report exactly which checks ran and skipped.

Main is PR-only. A separate session or delegated agent must review while peers
are active; reviewers cannot approve changes they authored. Shared GitHub
accounts use evidence-bearing COMMENT reviews because self-approval returns 422.
Only self-merge when the available agent list and lane activity establish that
you are alone, with a passing fresh-clone gate. The reviewer may merge.

Follow `.agents/skills/ship/SKILL.md`. Register worked-on PRs with the host's
thread-linking tool when available; this does not replace GitHub coordination.

## Code and evidence

Strict TypeScript, zero runtime dependencies, ordinary patterns. Node 22.18+
runs TypeScript directly: no parameter properties, enums or namespaces.

Read docs/UI-EXACTNESS.md before touching UI. Cite versioned evidence in each
package's ui-facts.json; unknown values stay UNVERIFIED. Check actual rendered
behavior as well as declarations. Commit our code and facts, never vendor
bundles or source. The corpus stays in gitignored pipeline/corpus/.

## Communication

Use authenticated `gh` for GitHub; no Runner registration, GitHub MCP setup or
shared-token files. Use `node tools/board/main.mjs --feedback` for the complete
live queue. Read source comments before claiming or merging; counts are not verdicts.

Claims are at most five lines. Findings belong in files and PRs. Update lane
issue bodies as indexes, not running essays. Close superseded work only after
linking its replacement and preserving useful findings. Keep real defects open.

Owner decisions live in docs/plan/decisions.md. Act on settled instructions;
ask only for new scope, product behavior or spending decisions.
