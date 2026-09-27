# BOOTSTRAP — onboarding (self-claiming)

**The paste-text lives at [`work/FLEET-PROMPT.md`](work/FLEET-PROMPT.md) — the ONE
stateless boot text: the user pastes that SAME text into every session they start,
any generation, any fleet size.** This file is the in-repo mirror: what a
bootstrapped session does and why. Protocol details: COORDINATION.md (identity: §11).

## Why claimed identity (v4.4, 2026-09-27)

The history of getting this wrong: gen-1 self-chosen handles (collided 5× on
agent-01); gen-2/3 spawn-rank math (duplicate handles, a mis-claimed slot); v4.1
rank-by-createdAt under one paste — rank MEMBERSHIP shifts for minutes during a
mass boot (one session's derived rank moved 1→2 while it worked), and a parallel
fleet on another account is invisible to sessions.list, so the 05:06Z and 06:07Z
gen-4 fleets computed identical rank tables, collided fleet-wide, and the "lowest
unregistered handle" backstop handed agent-05 to TWO sessions within 4 minutes.
v4.4: **identity is CLAIMED, never computed** — lowest-free slot, registration-order
on issue #1, comment-id tie-break, mandatory confirm-and-yield (COORDINATION.md §11).

## The flow (what the paste-text says)

0. **WHO YOU ARE** — rename to `loops fleet`; read the current generation in
   work/EPOCHS.md; read the tail of issue #1 (curl, page to the end); claim the
   LOWEST handle in agent-01…09 with no LIVE registration (LIVE = current
   generation + sess id in your sessions.list or activity ≤2h); post the
   registration with your FULL sess id; CONFIRM ~60s later — an earlier live
   registration on your handle means you YIELD to the next free slot. All nine
   taken → agent-10 reserve (shared duty set). The agent-01 holder carries the R10
   lead duty set; a user in-chat lead designation always wins. The fleet is however
   many instances the user started (default 1–5 → agent-01…05); unfilled slots are
   unclaimed work, not an error.
1. **READ** — README → COORDINATION → work/EPOCHS → work/STATUS → the current hub
   issue body (its number is pinned in work/SWARM-STATE.md) → your task issue.
   MCP playbook (learn once): `provider_unavailable` → `connections.list()` +
   `projects.set_connection_access` + pass `connectionId` explicitly;
   `list_issue_comments` returns only the OLDEST page → canonical state in issue
   BODIES, threads via unauthenticated curl on api.github.com; `get_content` caps
   at 50k chars → `git clone --depth 1` for bulk.
2. **REGISTER** on #1 AND the hub: `handle: agent-NN (gen N) | session: <sess id> |
   role RN | continuing T-xxx`.
3. **CLAIM** one task: `[claim] T-xxx by agent-NN` issue with the JSON body.
4. **WORK** — issues stay LEAN (state/evidence/links in bodies; code's durable home
   is the branch + PR; FILE blocks are the courier of last resort). Commits: git
   push with the shared vault token (`I-am-drunk/linear-loops-vault/GIT-TOKEN.md`
   via github.get_content) on a branch + PR, per the PR contract in AGENTS.md — or
   the land-bot (`/land …`) once Actions is unblocked (the hub tracks the billing
   lock). Merges: `github.merge_pull_request` after buddy review. Skills live IN
   the repo (canonical): `.agents/skills/{swarm-session-start,swarm-deliver-pr,
   swarm-review,swarm-github-playbook}/SKILL.md`.

## Hard rules (absolute)

Never commit Linear proprietary code (bundle/DMG/asar/prettified); all reimplementation
code original; the repo is PUBLIC — everything is forever; credentials never anywhere
(v4 sessions need none); one live claim; heartbeat it; files win over memory, issue
text over files, hub body over everything.

## RESET variant (if the user said RESET)

Old generations' session ids and claims are void (cold >2h or user-confirmed); your
handle is durable. Also read RESET.md, work/EPOCHS.md, work/handoffs/agent-NN.md, and
your predecessor's task issue before claiming. Continue — don't restart; delivered
work (STATUS/hub) is never re-claimed. Settled decisions stand.
