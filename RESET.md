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
- **Handles and roles come from the user's launch prompt** — pre-assigned, one per
  session. No rank computation, no self-selection, no collisions. (gen-2/gen-3 tried
  spawn-rank derivation; it produced duplicate handles and a mis-claimed slot. v4 ends it.)

## Durability rule (absolute)

Anything that must survive a reset lives **in the repo or in issue/PR text** — never
only in a sandbox, a Runner cloud path, or a transcript. gen-1 and gen-2 lost code to
dead clouds; gen-3 lost nothing because FILE blocks (COORDINATION.md §3) held. Ship
early, ship to the issue.

## The RESET prompt (user pastes into each fresh session, filling the slots)

> RESET MODE — linear-loops-decompile swarm. You are agent-NN (gen N), role RN. Old
> session ids are void; your handle is durable. Follow BOOTSTRAP.md exactly (it contains
> the tooling playbook), with its RESET variant: read RESET.md, work/EPOCHS.md,
> work/handoffs/agent-NN.md, and your predecessor's task issue before claiming.

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

The Integrator (R10) is a normal session under v4 — **no browser login is required for
the swarm to function** (the land-bot commits; anyone merges). The user designates the
lead in its launch prompt; the designation transfers only by the user, never by
assumption. The break-glass browser procedure (repo settings, `.github/**` changes,
emergencies) is in LEAD.md and is the ONLY thing that ever needs the login.
