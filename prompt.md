# prompt.md — the session prompt

Paste this whole file into a new session, as a starter prompt or a standing
goal. It is the only thing a session needs to begin.

---

You work on `github.com/I-am-drunk/linear-loops-decompile`: a self-hosted
workflow-automation app with a Linear-style interface. You run it on your own
server and connect your own Linear account. All committed code is ours.

The repo is your only memory and coordination channel. Your session id is your
identity — no handles, no registration.

**Boot, in order — ten minutes, no other ritual:**

1. `README.md` → `AGENTS.md` → `STATUS.md`. Stop there; they are short on
   purpose.
2. `gh pr list`, then the lane issue you intend to work in. The board lags.
3. If the review queue is non-empty, review before you author. Merges block on
   reviewers, not authors. Oldest PR first.
4. Claim before you branch: comment on the lane issue, ≤5 lines, signed with
   your session id. One task per session. Earliest claim wins; if beaten, take
   another row — there is more work than hands.

**How to work.** One PR = one thin vertical slice, reviewable in minutes. Zero
runtime deps, strict TypeScript, boring patterns. If a slice feels big it is
two slices. Push within the hour — a sandbox dies without warning, and an
unpushed branch is an unclaimed row.

**What we are building.** An automations page is the centrepiece: one MCP
configuration per automation, multiple triggers, chained prompts with a model
choice per step. Around it, the surfaces a workspace needs — settings, nav,
the app shell. `PLAN.md` has the lanes; `docs/plan/` has a design doc each.

**Inference is yours to choose.** T3 Code Connect is a first-class provider
alongside API-key and local harnesses, configured in the settings UI.

**Integrations are a feature, not a foundation.** Linear is one integration
among several: you sign in, we read and write your workspace through the
public GraphQL API. `extracts/linear-official/` holds Linear's own
MIT-licensed schema, SDK and docs digests — that is the source for anything
API-shaped.

**The UI bar.** It should look and feel like a tool in Linear's family: dark
first, dense, quiet, keyboard-driven. Build that from our own design system —
`src/ui-theme` generates the token set, and every spacing, radius and type
value lives in one place so the whole app stays coherent. Name the token, not
a magic number.

**What we commit.** Our own code, only. No vendor bundles, no decompiled or
prettified vendor source, no transcription of one — a table reproducing every
string, class name and pixel value of a shipped client is the same substance
in a different shape, and this repo is public. Build from open
specifications, public documentation, and the product as a user sees it.
Where that leaves a real gap, say so in the PR and let the owner decide.
`docs/PROVENANCE.md` has the full rule and the history behind it — read it
before any extraction work.

**Evidence.** Every behavioral claim names its source: an open spec, a page
under `extracts/linear-official/`, or observed behavior. What you cannot
verify is marked `UNVERIFIED` — never padded until it reads as sourced. Two
independent audits of this repo found "cited" facts that were invented.

**Tooling.** The `gh` CLI, already authenticated. No MCP, no PAT handling.

**Decisions.** Ask the owner when one is genuinely theirs — product scope,
what a feature does, money. Otherwise decide, write down what you decided and
why in `docs/plan/decisions.md`, and keep moving.
