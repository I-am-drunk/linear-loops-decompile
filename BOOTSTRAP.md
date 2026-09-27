# BOOTSTRAP — gen-4 onboarding (self-assigning)

**The paste-text lives at [`work/gen4-launch-prompt.md`](work/gen4-launch-prompt.md) —
the user pastes that SAME text into every new session.** This file is the in-repo
mirror: what a bootstrapped session does and why. Protocol details: COORDINATION.md.

## Why self-assignment (v4.1, 2026-09-27)

gen-2/gen-3 tried: self-chosen handles (collided 5× on agent-01), spawn-rank math over
all 10 sessions (one mis-claim), and per-session pre-assigned prompts (worked, but the
user pastes 9 prompts by hand — too slow). v4.1: **one identical paste; each session
derives its handle from its own creation order** via `sessions.rename` + `sessions.list`
(createdAt is immutable, so ranks are stable as later sessions appear), with the
issue-#1 registration log as the collision backstop.

## The flow (what the paste-text says)

0. **WHO YOU ARE** — rename to `gen4 swarm`, list same-titled sessions, rank by
   createdAt, map rank → `agent-02…agent-10` → role (table in the paste-text +
   work/ROSTER.md). Backstop: issue #1's newest comments via curl.
1. **READ** — README → COORDINATION → work/STATUS → hub #59 body → your task issue.
   MCP playbook (learn once): `provider_unavailable` → `connections.list()` +
   `projects.set_connection_access` (the GitHub connection is workspace-public since
   gen-4) + pass `connectionId` explicitly; `list_issue_comments` returns only the
   OLDEST page → canonical state in issue BODIES, threads via unauthenticated curl on
   api.github.com; `get_content` caps at 50k chars → `git clone --depth 1` for bulk.
2. **REGISTER** on #1 AND #59: `handle: agent-NN (gen 4) | session: <sess id> | role
   RN | continuing T-xxx`.
3. **CLAIM** one task: `[claim] T-xxx by agent-NN` issue with the JSON body.
4. **WORK** — deliverables as FILE blocks on your task issue the moment they work;
   land via the land-bot (`/land branch=… from=#… pr="…"`, COORDINATION.md §5) when
   GitHub Actions is unblocked (hub #59 tracks the billing lock); merges via
   `github.merge_pull_request` after buddy review.

## Hard rules (absolute)

Never commit Linear proprietary code (bundle/DMG/asar/prettified); all reimplementation
code original; the repo is PUBLIC — everything is forever; credentials never anywhere
(v4 sessions need none); one live claim; heartbeat it; files win over memory, issue
text over files, hub body over everything.

## RESET variant (if the user said RESET)

Old generations' session ids and claims are void; your handle is durable. Also read
RESET.md, work/EPOCHS.md, work/handoffs/agent-NN.md, and your predecessor's task issue
before claiming. Continue — don't restart; delivered work (STATUS/hub) is never
re-claimed. Settled decisions stand.
