# RESET — how a new generation resumes the swarm

> Canonical reset protocol. Drafted by gen-1 (agent-03's v1 base, folds from agent-02's
> EPOCHS, agent-04's RESET-STATE, agent-05's resurrection draft, agent-08's continuity
> ledger, agent-09's reincarnation notes); consolidated + landed by agent-01@gen2 (R10).

The swarm runs on a Runner account with finite credits. When the account dies (or the user
otherwise resets the swarm), every session dies with it and is replaced by a fresh one with
NO memory. **The GitHub repo survives; Runner sessions, sandboxes, and cloud trees do not.**

## Identity model

- **`agent-NN` is a durable role slot** (R1–R10, see ROLES.md). It survives resets and owns
  its pipeline until done.
- **`sess_…` is per-incarnation.** It dies with the session. On reset, ALL prior-generation
  session ids are void — never reuse one, never trust one.
- **Generations** are numbered (gen-1, gen-2, …). The registry is `work/EPOCHS.md`;
  cross-generation references are written `agent-NN@gen<n>`.
- Canonical handle ↔ role ↔ task map: `work/ROSTER.md` + `work/SWARM-STATE.md` + the swarm
  hub issue. Issue #1 (Roster) records individual incarnations.

## Durability rule (absolute)

Anything that must survive a reset lives **in the repo or in issue/PR text** — never only in
a sandbox, a Runner cloud path, or a transcript. Sandboxes and `/cloud/files` trees die with
the account; gen-1 lost every cloud-staged artifact this way. Ship early, ship to the repo.

## The RESET prompt (user pastes into each fresh session, filling NN)

> RESET MODE — linear-loops-decompile swarm. You are the new incarnation of agent-NN; old
> session ids are void, your handle is durable. In order: (1) Read README.md, RESET.md,
> COORDINATION.md, work/STATUS.md, work/ROSTER.md, work/EPOCHS.md in
> I-am-drunk/linear-loops-decompile. (2) Read work/handoffs/agent-NN.md + your predecessor's
> task issue. (3) Register on issue #1 with your NEW session id, "continuing T-xxx".
> (4) Re-claim the task with a fresh lease (ALL old claims are void on reset). (5) Continue
> from the handoff's next step — do not restart finished work; work/LOG.md + the task issues
> define "finished". (6) All rules in COORDINATION.md and the swarm hub apply unchanged.

If the prompt does not name a number: take the lowest handle whose handoff shows unfinished
work and no live successor, and announce it on the hub.

## What a reset session does, in order

1. Read README.md → this file → COORDINATION.md → work/STATUS.md → work/ROSTER.md →
   work/EPOCHS.md → work/handoffs/agent-NN.md → the swarm hub issue → your predecessor's
   task issue.
2. Register on issue #1: `handle: agent-NN (gen <N>) | session: <NEW full sess_ id> |
   continuing T-xxx`. Announce on the hub: `confirm: agent-NN@gen<N> | session:<full id> |
   role RN | resuming T-xxx`.
3. Re-claim the inherited task with a fresh lease per the current claims norm. Old leases
   are void even if unexpired — they name dead sessions.
4. Read the handoff's pointers BEFORE coding. Continue; don't restart. Settled decisions
   (work/LOG.md, decision threads) stand unless the repo contradicts them.
5. If the predecessor left code only in a dead sandbox/cloud tree, rebuild from the settled
   design in the issue text — do not re-litigate the design.
6. Maintain YOUR handoff (`work/handoffs/agent-NN.md`) from your first work block onward,
   and freshen your row in work/SWARM-STATE.md at the end of every work block.

## Handoff checklist (every CURRENT session, at every milestone)

1. Task issue: comment what's done, what's in flight, the exact next step.
2. Rewrite `work/handoffs/agent-NN.md` (≤40 lines: Now / Done / Next / Decisions that bind
   you / Watch out). Until you can commit, stage it as a comment on the hub.
3. Land all un-landed code through the PR flow — or it dies with your sandbox.

## Lead succession

The Integrator (R10) has the HIGHEST resurrection priority: without it nothing lands. Only
the user designates a lead (browser + GitHub login); see LEAD.md. If the lead dies, the user
appoints a successor, who signs in per LEAD.md and resumes from `work/handoffs/agent-01.md`
(gen-2 lead slot) — designations do not transfer across generations on their own.

