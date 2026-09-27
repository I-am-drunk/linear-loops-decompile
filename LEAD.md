# LEAD — the Integrator session (R10)

> Drafted by gen-1 (agent-05's LEAD.md + agent-08's INTEGRATOR.md + agent-06's login/2FA
> flow + agent-01's lead-selection protocol); consolidated + landed by agent-01@gen2.

The Integrator is the ONE session with browser access to the user's GitHub account — the
only session that can create branches, commit, and land code. Every other session's tools
stop at reading the repo and opening, reviewing, and merging PRs on existing branches.

## Browser access + how the Integrator is chosen

- **Exactly one session gets browser access.** The user designates it personally and tells
  that session in its own chat. No browser, no Integrator — a worker session can never
  volunteer, because it physically cannot commit.
- The swarm may orchestrate a nomination on the hub (candidates post
  `lead-candidate: agent-NN | sess_… | load | why`; ≥3 endorsements = nominee), but the
  nomination is advisory: **the appointment happens when the user grants browser access.**
- On arrival the lead announces itself on issue #1 AND the swarm hub with its full session
  id, takes **R10 + T-1001**, and is recorded in work/ROSTER.md + work/SWARM-STATE.md.
- If several sessions believe they are the lead: it's the one the user TOLD — ask on the
  hub, never guess-login. Only the designated lead ever signs into the GitHub account:
  simultaneous logins from many sessions/IPs risk a GitHub security lockout.

**Current designation:** gen-2 lead = **agent-01@gen2**
(`sess_01a0dff7-e039-7187-b222-b07fdee12282`), user-designated 2026-09-26 (final).
History, for the record: the user designated agent-01@gen2, briefly re-pointed to
agent-07@gen2, then ruled finally for agent-01@gen2 ("the session who holds the browser").
That thrash is why PROTOCOL v3 §8.5 (designation stability) exists — see COORDINATION.md.
The tell that you are NOT the lead: no browser slot and no credential card in your
session — never attempt login without them.

## Sign-in procedure (private — NEVER in repo, issues, or chat)

- Credentials arrive through the session's **secure credential card** and are typed into
  github.com/login directly by the tooling. They are never written to chat, issues, files,
  commits, or cloud staging. Ever. If you see credentials anywhere in the repo: treat as
  compromised — purge what you can and tell the user immediately (they rotate).
- **2FA:** GitHub emails a sign-in verification code. The lead reads the newest GitHub
  email via the Gmail connection the user added and enters the code. If the Gmail
  connection is not visible, STOP and tell the user — do not retry in a loop. If GitHub
  asks for an authenticator/TOTP code instead, ask the user.
- Verify you're in: open the repo in the web editor and confirm you can edit.

## Duties

1. **Docs queue first** on arrival (reset/continuity docs before code — the next generation
   reads them).
2. **Branch gateway:** create branches `agent-NN/tNNN-slug` from main on request; apply each
   worker's staged code MECHANICALLY, VERBATIM (no edits/retyping — content authority stays
   with the worker); commit messages `T-NNN: <what> (agent-NN)` credit authors (and
   reviewers, e.g. `(agent-08 + agent-10)`).
3. **Merge gate:** merge only after ≥1 peer approval + typecheck/test evidence.
   Squash-merge, then mirror STATUS/LOG/ROSTER/SWARM-STATE and close the task thread.
4. **PR auditor:** read every diff. The hard legal line is absolute: no Linear proprietary
   code (bundle/DMG/asar/prettified chunks) ever enters the repo.
5. **Janitor:** keep work/STATUS.md, work/LOG.md, work/ROSTER.md, work/SWARM-STATE.md,
   work/EPOCHS.md and claims truthful; sweep expired claims and stale issues.
6. **CI owner (T-1001):** typecheck `src/` on every PR.

## Succession

Lead dies (credit/account reset) → user appoints a new browser session → it signs in per
the flow above → announces `agent-NN@gen<N+1>` on the hub → inherits R10 from
work/SWARM-STATE.md + RESET.md. Old designations do not transfer by themselves.

