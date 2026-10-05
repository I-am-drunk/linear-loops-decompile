# AGENTS.md — how to work here

Boot: `prompt.md` → `README.md` → this file → `STATUS.md`. Ten minutes.

## The loop

1. **Pick** from `PLAN.md`. Check the lane issue for an existing claim.
2. **Claim**: comment on the lane issue, **≤5 lines** — lane, scope, session id.
   Then branch `<lane>-<slug>` from `main`.
3. **Push within the hour.** Unpushed is unclaimed. This is the only staleness
   rule; there are no negotiated windows. If a branch has no commits after an
   hour, anyone may take the row.
4. **Open the PR** — what, why, evidence — then move to your next task. Do not
   sit on merges.
5. **Review before you author** whenever the queue is non-empty. Oldest PR
   first; recency bias starves the oldest, which is usually the one blocking a
   dependent slice.

One task per session. Earliest claim wins; if beaten, take another row.

## Merging

- A PR needs **a peer review before merge whenever another session is around**
  to give one. Self-merge only when you are verifiably the only session
  running (`ListAgents`, or no peer activity on the lanes) and the gate passes
  on a fresh clone. The reviewer may be the merger.
- Beyond that: gate evidence, a clean provenance audit, and zero unaddressed
  feedback.
- **No merges with unaddressed feedback.** Addressed = fixed in code, or
  answered on the thread with a reason. Silence is not addressing. Check both
  issue comments and inline review comments.
- No self-merges while a peer session is active. If you are verifiably alone,
  self-merge once the gate passes on a fresh clone.
- Formal GitHub approval is impossible here: every session shares one account
  and GitHub returns 422 on self-approval (`.agents/skills/ship/SKILL.md`
  §Before you merge). So verdicts are COMMENT reviews carrying evidence, and a
  reviewer checks the comment text — issue comments AND inline review
  comments — rather than looking for an APPROVED state that can never appear.
- `main` is PR-only for everyone (server-side ruleset).

## Writing

Short. Tables over prose. A claim is five lines; findings go in files and PRs.
The project's worst failure mode was 600-word coordination comments about
coordination — several sessions spent their whole run on thread prose and
shipped nothing. If you are writing paragraphs on a thread, write a file.

## Code

- One PR = one thin vertical slice, reviewable in minutes. Never a whole layer.
- Zero runtime deps, strict TypeScript, boring patterns. If a slice feels big it
  is two slices.
- We run `.ts` directly via Node type stripping, which forbids emit-requiring
  syntax: **no parameter properties** (`constructor(private x)`), **no `enum`**,
  **no namespaces**. Use explicit field assignments and const objects.
- The gate is `bash ci/check-src.sh`.

## Evidence

Every behavioral claim names its source: an open specification, a page under
`extracts/linear-official/`, or observed behavior. What you cannot verify is
marked `UNVERIFIED` — not padded until it looks sourced. Two independent
analyses of this repo found "cited" facts that were invented; that is the
failure this rule exists to prevent.

**Read `docs/UI-EXACTNESS.md` before touching any UI file.** The bar is
EXACT: our UI is the same UI Linear renders. Every dimension, spacing value,
radius, font stack and copy string is read from the corpus and cited in
`ui-facts.json`. `ci/check-ui.sh` fails a UI package that ships no facts.
Run it yourself and run it on anything you review — there is no CI job doing
it for you yet (issue #331), so a UI slice built from memory merges unless a
human stops it.

Commit only our own code — never Linear's bundles or source. Extracted facts
are what we commit; the corpus stays in gitignored `pipeline/corpus/`.

## Tooling

`gh`, already authenticated. No MCP, no PAT, no token files. For comment tails,
`gh api "repos/:owner/:repo/issues/<N>/comments?per_page=100&page=<K>"`.

## Product decisions

Ask the owner when a decision is genuinely theirs — product scope, what a
feature should do, money. Otherwise decide, write down what you decided and
why, and keep moving. Open decisions live in `docs/plan/decisions.md`.
