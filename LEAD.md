# LEAD — the Integrator session (R10)

> v4 rewrite (2026-09-27, agent-01@gen4). Supersedes the gen-1/2 browser-centric LEAD.
> History: gen-1 drafts (agent-05/06/08/01); gen-2 browser lead; gen-3 lost ~90 minutes
> to login + 2FA before one commit could land. v4 removes the dependency.

**The Integrator as a privileged role is dead (v4.2).** Every session commits (the
shared vault token — or the land-bot once Actions runs) and every session merges
reviewed PRs via `github.merge_pull_request`. No browser, no login, no special session
is required for the swarm to function. What remains here is a **duty set, not a
power**: janitor + tie-breaker + the only two jobs that still need the browser —
vault-token rotation and `.github/**` changes.

## Designation

No worker slot is spent on this: the lead duties ride on whichever session the user
names — currently **agent-01@gen4** (sess_01a0e088-c660-759e-a222-9dcebd33236f) — and
agent-10 holds reserve/janitor as backup. Latest explicit user designation wins;
designations never transfer across generations on their own. If two sessions believe
they are the lead: the one the user TOLD — ask on the hub, never guess. The 9 worker
sessions need no Integrator among them.

## Duties

1. **Hub body** — keep the current hub issue's BODY the live truth (roster, board,
   decisions). Comment paging is broken; the body is the swarm's memory.
2. **Truth passes** — after each merge sweep: `work/STATUS.md`, `work/LOG.md`,
   `work/ROSTER.md`, `work/SWARM-STATE.md`, `work/EPOCHS.md`; close task issues; sweep
   expired `[claim]` issues. (Land these via `/land branch=docs/truth-pass …` like any
   other change.)
3. **PR audit (legal line, absolute)** — read every diff before merge: no Linear
   proprietary material (bundle/DMG/asar/prettified chunks), ever. The repo is public.
4. **`.github/**` gatekeeper** — the land-bot refuses `.github/**`; only the lead lands
   workflow/bot changes (break-glass procedure below). Review bot changes twice: the bot
   is the swarm's commit privilege.
5. **Tie-breaks** — claim collisions, review disputes, designation questions. Rulings
   go on the hub body.

## Break-glass: the browser + PAT (ONLY for settings, `.github/**`, emergencies)

1. The user signs you into GitHub in your browser via the secure credential card
   (2FA: SMS/email relay — email codes are readable via the user's Gmail connection).
   Never type credentials from chat into anything; never write them anywhere.
2. Verify: dashboard shows `I-am-drunk`.
3. For git pushes: create a classic PAT (`repo` + `workflow`, 7-day, note
   `swarm-lead-breakglass`) at github.com/settings/tokens/new, use it from your sandbox
   only, and **revoke it the moment the work is done** (settings/tokens). A PAT in a
   transcript, issue, file, or cloud path = compromised: tell the user immediately.
4. The one GitHub setting the swarm depends on (already set 2026-09-27): repo Settings →
   Actions → General → Workflow permissions = **Read and write** + **Allow GitHub
   Actions to create and approve pull requests**. Without these the land-bot cannot
   commit or open PRs — check them first if the bot 403s.

## Succession

Lead dies → user appoints a successor in a fresh session → it takes R10 per the
designation rule, reads this file + the hub body + `work/EPOCHS.md`, and resumes. No
login is needed unless break-glass work is pending.
