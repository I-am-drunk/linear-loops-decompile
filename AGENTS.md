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
   The same rule binds RESEARCH (added 2026-09-29 after the #295 02:53Z loss;
   converged by four independent recoveries, reconciled 12:41Z): research is
   not done until posted. A session doing corpus mapping or any long read
   posts partial findings to the coordination thread at least every ~hour of
   work — an ugly half-map on the thread beats a beautiful one in a dead
   sandbox. A claim silent for ~2h with zero posted partials is reclaimable,
   with whatever partials exist as the starting corpus.
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
   - Feedback gate (user directive 2026-09-27, absolute): NO PR merges while it
     has unaddressed feedback — CodeRabbit threads or peer review comments.
     Addressed means fixed in code, or answered on the thread with a reason
     (link the consensus or evidence; "declined because …" is addressing,
     silence is not). The merging reviewer verifies every thread is addressed
     before merging: scan the PR's issue comments AND inline review comments
     (`curl -s …/pulls/<N>/comments?per_page=100`, following the `Link:
     rel="next"` header until it disappears). When in doubt, do not merge.
   - Any session may merge any PR that has gate evidence, a clean legal audit,
     and zero unaddressed feedback threads.
     `main` is PR-only for everyone (server-side ruleset; no exceptions).
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

## Product scope (non-negotiable)

Read `SPECS/product-contract.md` before proposing or implementing a product slice.
We build an original, self-hosted **Loops-only** product—not Linear generally.
The sidebar is Loops, only the Loops-required views, and our Settings; do not build
tracker navigation or copy Linear Settings. Exactness is still required for every
scoped Loops surface.

Keep the credential boundaries explicit:

- Linear PAT/OAuth = documented public-API data plane for reads/events/audited
  write-back, never the AI brain.
- User-session chat bridge = the golden-goose primary brain, separate from public
  API credentials.
- External inference = fallback only.

A slice must identify the Loop-operator job it enables, its corpus/docs authority,
and its golden proof. If it is not necessary to create, configure, run, inspect, or
write back a Loop—or to configure our server—it is out of scope.

## Hard rules (load bearing)

- This repo is PUBLIC. Never commit Linear proprietary material: no app bundles,
  no DMG/asar contents, no decompiled or prettified Linear code. The corpus lives
  only in `pipeline/corpus/` (gitignored). Commit only original code and extracted
  facts (op names, shapes, behavior notes).
- The shared git token lives in the private vault repo `I-am-drunk/linear-loops-vault`
  (`GIT-TOKEN.md`); read it with `github.get_content` and use it freely. This GitHub
  account exists for agents (owner directive 2026-09-27) — handling the token in
  chat or command output is fine. Just never COMMIT it to this public repo:
  GitHub secret scanning auto-revokes an exposed classic PAT, which breaks every
  session's push access.
- The acceptance bar is the corpus plus `docs/feature-matrix.md`, and the bar is
  EXACT: the same Linear Loops UI and behavior, not a plausible version of it. If
  a behavior cannot be verified against the corpus or Linear's docs, mark it
  unverified. Do not guess.
- Our method is EXACT REPRODUCTION, not clean-room: we read the decompiled app
  directly and reproduce its behavior, structure, and values precisely, writing
  our own original code. (The legal line is about Linear's code, never about its
  behavior: behavior, values, and algorithms are reproduced exactly.)
- Every Linear-API claim in `KNOWLEDGE.md`, `SPECS/`, or a `src/` comment NAMES
  its source: a corpus chunk, an `extracts/linear-official/docs-site/<page>.md`
  digest, `extracts/linear-official/AGENT-API.md`, or the vendored schema. The
  upstream `extracts/linear-official/docs/*.md` files are one-line redirect
  stubs and are NEVER citable (issue #185; they are how the hollow-docs gap
  survived unnoticed). Two-source discipline: the corpus says what the CLIENT
  does; the official docs say what the PUBLIC API guarantees. A dataplane/server
  behavior claim needs the docs citation; corpus-only citations suffice only for
  client-api/sync-route work the docs do not cover.

## GitHub tooling

Load `.agents/skills/github/SKILL.md` before heavy GitHub work. Short version:
`github.get_content` for files; unauthenticated `curl` on api.github.com for
comment tails (the MCP lists the oldest page only); writes may stage for user
approval, check the return value; on `provider_unavailable`, resolve the connection
id with `connections.list` and pass `connectionId` explicitly.

## Boot text (paste this into every new session)

Keep this text plain and neutral: it is pasted into fresh sessions as a raw
prompt, with none of the repo's context attached, so it must read as the
ordinary software-collaboration request it is. The full method, evidence rules,
and legal lines live in README/AGENTS/KNOWLEDGE, which the session reads in its
first minutes anyway — nothing is lost by keeping the prompt itself simple.
Do not reintroduce project jargon or dramatic framing here; if the method
changes, update README/AGENTS and leave this prompt generic. "Generic" is
about TONE, not content: the boot sequence, claim discipline, curl recipes,
and the corpus-fetch instructions below are required steps — keep them intact
when editing.

```
You work on the public repo github.com/I-am-drunk/linear-loops-decompile:
an original, open reimplementation of a workflow-automation feature, built to
verified behavioral parity against a reference corpus of extracted facts. All
committed code is our own. The repo is your only memory and coordination
channel; your Runner session id is your identity (no handles or registrations).

Boot sequence, in order:
1. Read README.md -> AGENTS.md -> STATUS.md.
2. Before touching anything, read the TAIL of the coordination thread
   (issue #225) and the open-PR list — the board lags both by hours.
3. Reviewing open PRs is first-class work; prefer draining the review queue
   over opening a new PR when the queue is non-empty (merges are blocked on
   reviews, not on authors).
4. To take a task: check it is unclaimed in the thread tail AND has no open
   PR, then post a claim comment (signed with your session id) BEFORE you
   branch. One task per session; earliest claim wins; if beaten, move on —
   there is more work than hands.

GitHub reads without the MCP pitfalls (the MCP lists issue comments
OLDEST-first and caps file reads):
- Thread tails: curl -s "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/<N>/comments?per_page=100&page=<K>" (page until a short page)
- Raw files: curl -s https://raw.githubusercontent.com/I-am-drunk/linear-loops-decompile/<ref>/<path>
- Bulk: git clone --depth 1 https://github.com/I-am-drunk/linear-loops-decompile

The reference corpus is committed in the private repo
I-am-drunk/linear-loops-vault under corpus/; fetch it with a FULL git clone and
verify the file counts per pipeline/README.md before trusting it (partial
fetches fail silently). Regenerate it only for the ~30-day drift check:
bash pipeline/run.sh
```
