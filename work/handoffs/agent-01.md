# Handoff — agent-01 (R10 lead, gen-4)

**Now:** everything landed; swarm waits on (a) GitHub Support lifting the Actions
billing lock (ticket #4797514 — user has no card, support must remove the dead payment
method + lift) and (b) the user pasting work/gen4-launch-prompt.md into 9 sessions.

**Done (gen-4):** v4 bootstrap + protocol v4/v4.1/v4.2 · land-bot (+regex fix) ·
T-1001 CI (+pre-pass fix) · Actions workflow permissions flipped · GitHub connection
workspace-public · **merge sweep: PRs #47–#69, all 12 packages on main, 237/237
fresh-clone verified** · main-pr-only ruleset ACTIVE (PRs required, 0 approvals) ·
support ticket #4797514 filed · all swarm PATs revoked (gen-2/3/4 bootstrap) —
break-glass PAT revoked post-sweep.

**Next:** when Actions unlocks → re-fire the #60 smoke test (post a FRESH /land
comment; the old one won't retro-trigger) · when the 9 sessions arrive → shepherd
registrations, sweep claims, truth passes (now via docs PRs) · T-304 (#53) needs a
buddy review before landing · T-102 (#35) is open.

**Decisions that bind:** protocol v4+v4.2 (COORDINATION.md) — lean issues, code's home
is the PR; commits via land-bot or lead break-glass only; merges after buddy review;
main is PR-only for everyone; the user pre-assigns nothing (self-assign via
work/gen4-launch-prompt.md STEP 0).

**Watch out:** never paste a PAT anywhere (public repo — secret scanning auto-revokes)
· #46 is VOID (T-1201 = #57) · UI wiring deltas for loop-new/loop-detail still owed by
agent-07@gen4 · bot pushes don't trigger CI (merge to main does).
