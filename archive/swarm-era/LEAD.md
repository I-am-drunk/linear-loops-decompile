# LEAD — the lead (R10): janitor, tie-breaker, break-glass

> v4.3 (2026-09-27, agent-01@gen4). The lead is a **duty set, not a power**. Every
> session commits (shared vault token, or the land-bot once Actions runs) and every
> session merges reviewed PRs. No browser, login, or special session is required for
> the swarm to function. What follows is the only work that still needs a name on it.

## The four duties

1. **Hub body + truth passes** — keep the current hub issue's BODY the live truth;
   after each merge sweep: `work/STATUS.md`, `work/LOG.md`, `work/ROSTER.md`,
   `work/SWARM-STATE.md`, `work/EPOCHS.md`; close merged/void task issues. (Land these
   via docs PRs like any other change — main is PR-only for the lead too.)
2. **Claim hygiene + tie-breaks** — sweep expired `[claim]` issues; rule on claim
   collisions, review disputes, designation questions. Rulings go on the hub body.
3. **PR audit (legal line, absolute)** — read diffs before merge: no Linear
   proprietary material, ever. The repo is public.
4. **Break-glass (the only browser jobs)** — `.github/**` changes (the land-bot
   refuses them by design), repo settings, and **vault-token rotation**
   (`linear-loops-vault/GIT-TOKEN.md`, expires 2026-10-27; procedure is in that file).
   The browser + the user's GitHub login are needed ONLY for these — never for
   ordinary swarm work.

## Designation

The lead rides on whatever session the user names — no dedicated slot is spent on it.
In a full-fleet boot (work/FLEET-PROMPT.md) the duties attach to **agent-01**
(rank 0), with **agent-10** (reserve) as backup. Latest explicit user designation
wins; designations never transfer across generations on their own. If two sessions
believe they are the lead: the one the user TOLD — ask on the hub, never guess.
(Current: **agent-01@gen4**, sess_01a0e088-c660-759e-a222-9dcebd33236f.)

## Break-glass procedure (browser, ONLY for the jobs above)

1. The user signs you into GitHub via the secure credential card (2FA: SMS/email
   relay — email codes are readable via the user's Gmail connection). Never type
   credentials from chat; never write them anywhere.
2. Verify: dashboard shows `I-am-drunk`.
3. For git pushes: mint a classic PAT (`repo` + `workflow`, 7-day, note
   `swarm-lead-breakglass`), use it from your sandbox only, **revoke it the moment
   the work is done**. A PAT in a transcript, issue, file, or cloud path =
   compromised: revoke, rotate, tell the user.
4. The one GitHub setting the swarm depends on (set 2026-09-27): repo Settings →
   Actions → workflow permissions = Read and write + allow PR creation. Check it
   first if the land-bot 403s once Actions is unlocked.

## Succession

Lead dies → the user names a successor (or the reserve steps up and the user
confirms on the hub) → it reads this file + the hub body + `work/EPOCHS.md` and
resumes. The browser is needed only when a break-glass job is actually pending.
