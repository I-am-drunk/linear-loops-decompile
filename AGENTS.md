# AGENTS.md: the operator manual

Boot reads, in order: `README.md` (what we build) -> this file -> `STATUS.md` (the
board). Two minutes, no other ritual. Repo-local skills:
`.agents/skills/{boot,ship,github}/SKILL.md`.

## Who works here

However many sessions the user started. There is no identity machinery: no handles,
no generations, no registrations. That system is archived in `archive/swarm-era/`;
it produced collisions in every generation that used it. Your identity is your
Runner session id. Sign issue comments and commit trailers with it when provenance
matters.

## The loop

1. Pick work from `STATUS.md` or open issues. Check the issue is unassigned, then
   assign yourself. One active task per session. If two sessions take the same
   issue, earliest assignment keeps it; the other moves on. There is more work
   than hands.
2. Branch from `main`: `<task>-<slug>`. Commit early and often; branches and PRs
   are the durable store, sandboxes die at reset.
3. Open the PR (what, why, evidence), then MOVE ON to your next task immediately.
   Do not sit on merges.
4. Merging, in parallel with everything else (tightened 2026-09-27, user
   directive issue #154):
   - While ANY peer session is active: no self-merges, including blocking PRs
     (a blocking PR gets reviewed, not force-merged; do non-blocking work or
     audit/review while you wait). Exception: trivial board fixes.
   - When you are verifiably the only session running: a blocking PR may be
     self-merged once the gate passes on a fresh clone and you audited the
     diff against the legal lines.
   - Non-blocking PR: leave it open for review. Every session scans open PRs at
     boot and between tasks, reviews what it can (read the diff, run the gate),
     and merges what passes. Reviews matter: the author may be a small model, and
     a reviewer session may catch deeper issues.
   - Any session may merge any PR that has gate evidence and a clean legal audit.
     `main` is PR-only for everyone (server-side ruleset; no exceptions).
   - FEEDBACK GATE (user directive 2026-09-27, issue #154): a PR merges only
     after every CodeRabbit thread and every peer comment is addressed — a fix
     commit or a reply with a reason; silence is not addressing. An unresolved
     Major/Critical finding blocks the merge. And never merge a PR younger than
     its CodeRabbit review: wait for the summary comment before merging at all
     (four rebuild-era PRs merged with zero review this way; #153 is the lesson).
5. When the board changes, update `STATUS.md` in the same PR.

## TypeScript style (strip-only safe)

We run `.ts` directly via Node's type stripping. That mode forbids emit-requiring
syntax: NO parameter properties (`constructor(private x)`), no `enum`, no
namespaces. Use explicit field assignments, const objects, and plain types. The
gate (`ci/check-src.sh`) runs the real Node loader, so violations fail there.

## Slices (how we build)

One PR = one thin vertical slice, reviewable in minutes. Never a whole layer,
never the whole stack. Foundation slices (transport, boot, settings) set the
patterns every later slice copies: give them extra care while change is cheap.
Keep code small: zero runtime deps, strict TS, boring patterns. If a slice feels
big, it is two slices. The sequence lives in `PLAN.md`.

## Hard rules (load bearing)

- This repo is PUBLIC. Never commit Linear proprietary material: no app bundles,
  no DMG/asar contents, no decompiled or prettified Linear code. The corpus lives
  only in `pipeline/corpus/` (gitignored). Commit only original code and extracted
  facts (op names, shapes, behavior notes).
- Credentials live only in the private vault repo `I-am-drunk/linear-loops-vault`
  (`GIT-TOKEN.md`). Never in this repo, issues, PRs, chat, or cloud files. Read it
  with `github.get_content`, use it through a git credential helper, never print it.
- The acceptance bar is the corpus plus `docs/feature-matrix.md`, and the bar is
  EXACT: the same Linear Loops UI and behavior, not a plausible version of it. If
  a behavior cannot be verified against the corpus or Linear's docs, mark it
  unverified. Do not guess.

## GitHub tooling

Load `.agents/skills/github/SKILL.md` before heavy GitHub work. Short version:
`github.get_content` for files; unauthenticated `curl` on api.github.com for
comment tails (the MCP lists the oldest page only); writes may stage for user
approval, check the return value; on `provider_unavailable`, resolve the connection
id with `connections.list` and pass `connectionId` explicitly.

## Boot text (paste this into every new session)

```
You work on the public repo github.com/I-am-drunk/linear-loops-decompile: a
self-hosted Linear Loops, the EXACT same UI and behavior. The brain to prove is
the golden goose: Linear's own AI chat route (issue #14). The repo is your only
memory and coordination channel. Read README.md, then AGENTS.md, then STATUS.md.
Pick unassigned work per AGENTS.md and start. Your Runner session id is your
identity; there are no handles, registrations, or other rituals.

GitHub reads without the MCP pitfalls (the MCP lists issue comments OLDEST-first
and caps file reads):
- Thread tails: curl -s "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/<N>/comments?per_page=100&page=<K>" (page until a short page)
- Raw files: curl -s https://raw.githubusercontent.com/I-am-drunk/linear-loops-decompile/<ref>/<path>
- Bulk: git clone --depth 1 https://github.com/I-am-drunk/linear-loops-decompile

The decompile corpus (prettified client + analysis) is committed in the PRIVATE
vault repo I-am-drunk/linear-loops-vault under corpus/; fetch it per
pipeline/README.md (much faster than generating). Regenerate it only for the
~30-day drift check: bash pipeline/run.sh
```
