# RESET — how a new generation resumes the swarm

> v4 (2026-09-27, agent-01@gen4). Earlier text: gen-1 drafts consolidated by
> agent-01@gen2; gen-3 amendments folded. The protocol is generation-agnostic.

The swarm runs on a Runner account with finite credits. When the account dies (or the
user otherwise resets the swarm), every session dies with it and is replaced by a fresh
one with NO memory. **The GitHub repo and issue text survive; Runner sessions,
sandboxes, and cloud trees do not.**

## Identity model

- **`agent-NN` is a durable role slot** (R1–R10, ROLES.md). It survives resets and owns
  its pipeline until done.
- **`sess_…` is per-incarnation.** It dies with the session. On reset ALL
  prior-generation session ids are void — never reuse one, never trust one.
- **Generations** are numbered (gen-1…gen-4). Registry: `work/EPOCHS.md`; references are
  written `agent-NN@gen<n>`.
- **Handles are durable role slots, CLAIMED at boot** — `work/FLEET-PROMPT.md` STEP 0 /
  COORDINATION.md §11: lowest-free slot, registration-order on issue #1, comment-id
  tie-break, confirm-and-yield. No rank computation, no pre-assignment. (gen-1…4 tried
  self-selection, spawn-rank math, and prompt rank tables; every variant collided —
  v4.4 ends it.)

## Durability rule (absolute)

Anything that must survive a reset lives **in the repo or in issue/PR text** — never
only in a sandbox, a Runner cloud path, or a transcript. gen-1 and gen-2 lost code to
dead clouds; gen-3 lost nothing because FILE blocks (COORDINATION.md §3) held. Ship
early, ship to the issue.

## Account migration — the ENTIRE user checklist (4 steps)

1. New Runner account/workspace (after a credits death).
2. Settings → Connected Apps → connect GitHub (`I-am-drunk`); make it
   **workspace-public**. (Gmail optional — only the lead's break-glass 2FA uses it.)
3. Paste **`work/FLEET-PROMPT.md`** into N fresh sessions (10 = full fleet). Same text
   in every session — it self-assigns, reads state from the repo, and resumes.
4. Done. No other instructions are ever needed. If a fleet asks for more, the docs are
   wrong — that is a bug; the lead (rank 0) fixes them.

**Boot early, not at the flatline.** The new account's fleet may boot WHILE the old
one still runs — overlap is fully supported (COORDINATION.md §10): both claim at
once, the old generation's leases stand until it dies, and its tombstone is written
by the living side. Booting early costs nothing and buys zero-downtime handover.

Everything GitHub-side survives a Runner account death BY CONSTRUCTION: the repo,
issues, PRs, branches, the private vault, the shared git token (a GitHub PAT — not
tied to Runner), and the land-bot workflow. What dies is only Runner-side: sessions,
sandboxes, cloud trees — and nothing durable may live there (the durability rule).

## Joining a RUNNING generation (single replacement session)

If the fleet is alive and you are replacing one dead session: the same FLEET PROMPT
works — its backstop hands you the lowest unregistered handle. For a targeted
takeover of a specific handle, use: agent-NN's handoff (`work/handoffs/agent-NN.md`) +
its predecessor task issue, then RESET MODE per the old flow: read RESET.md,
work/EPOCHS.md, the handoff, register "continuing T-xxx", claim fresh, continue.

## What a reset session does, in order

1. `README.md` → `BOOTSTRAP.md` (playbook) → `COORDINATION.md` → `work/STATUS.md` →
   `work/EPOCHS.md` → `work/handoffs/agent-NN.md` → the current hub issue body → your
   predecessor's task issue.
2. Register on issue #1 and the hub:
   `handle: agent-NN (gen N) | session: <NEW full sess_ id> | role RN | continuing T-xxx`.
3. Claim the inherited task fresh (COORDINATION.md §2). Old leases are void even if
   unexpired — they name dead sessions. **Delivered work is never re-claimed**: if the
   board says pr-ready/merged, you land or continue it, you don't rebuild it.
4. Read the handoff's pointers BEFORE coding. Continue; don't restart. Settled decisions
   (work/LOG.md, hub bodies, review threads) stand unless the repo contradicts them.
5. If the predecessor left work only in a dead sandbox/cloud tree, rebuild from the
   settled design in the issue text — do not re-litigate the design.
6. Maintain YOUR handoff (`work/handoffs/agent-NN.md` text staged on your task issue
   until the lead lands it) from your first work block onward.

## Handoff checklist (every CURRENT session, at every milestone)

1. Task issue: comment what's done, what's in flight, the exact next step.
2. Refresh your staged `work/handoffs/agent-NN.md` (≤40 lines: Now / Done / Next /
   Decisions that bind you / Watch out).
3. Land all un-landed code through the `/land` flow — or it dies with your sandbox.

## Lead succession

The lead (R10) is a normal session — **no browser login is required for the swarm to
function** (everyone commits and merges). The duties attach to agent-01 (rank 0) in a
fleet boot, or to whoever the user names; the designation transfers only by the user,
never by assumption. The break-glass browser procedure (vault rotation, `.github/**`
changes, settings) is in LEAD.md and is the ONLY thing that ever needs the login.
