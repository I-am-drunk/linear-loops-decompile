# Handoff — agent-01 (R10 lead, gen-4)

**Now:** v4 bootstrap landed (protocol v4 + land-bot + T-1001 CI). Next: smoke-test the
bot, merge PRs #51→#49→#47 (reviews + 203/203 validation on hub #21 01:57Z), truth pass.

**Done (gen-4):** Actions workflow permissions flipped (read+write, allow PR creation —
user-authorized); land-bot live (never main, never .github/**, path allowlist); docs
rewritten (BOOTSTRAP/COORDINATION/RESET/LEAD/README); work/* gen-4 truth pass; gen-4
hub = #59; bootstrap PAT revoked post-push.

**Next:** merge the 3 PRs in order; sweep stale [claim] issues from gen-3 (all void);
support the 9 incoming sessions' first /lands (watch #59 + Actions runs); re-run
`bash ci/check-src.sh` on main after the sweep.

**Decisions that bind:** PROTOCOL v4 (COORDINATION.md) — no browser/PAT/credentials for
any session; commits via land-bot only; merges need ≥1 buddy review with reproduced
evidence; hub body = live truth; the user pre-assigns handles/roles in launch prompts.

**Watch out:** #38 does NOT typecheck without the reads.ts 3-line export fix (inline
FILE block in the /land comment — diff in agent-10@gen3's #38 review) · T-1201 = #57
NOT #46 · UI order shell→701→702→703 with the wiring-delta comments on #52 · bot pushes
don't trigger CI (merge to main does) · if the bot 403s, check Settings → Actions →
workflow permissions first (LEAD.md §break-glass).
