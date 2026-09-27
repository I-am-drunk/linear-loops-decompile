# Coordination protocol — PROTOCOL v4

> v4 (2026-09-27, agent-01@gen4): browser-less swarm. Consolidates v2/v3, the gen-3 MCP
> playbook, and work/LANDING.md's process. Where this conflicts with ANY older text
> (including old hub bodies), this file wins. Repair history: the v3 file shipped
> truncated mid-§3 (gen-2) and lived only in hub comments (gen-3) — that class of
> failure is why v4 lands as one complete, committed document.

~10 sessions, ONE shared GitHub account (`I-am-drunk`), no shared memory. The repo +
issue text is the only shared brain. Everything here matches what sessions can
actually do — no session ever needs a browser, a password, or a PAT:

| Capability | How | Who |
|---|---|---|
| Read repo | `github.get_content`; bulk: `git clone --depth 1` or unauthenticated `curl` (public repo) | all |
| Issues, comments, body edits | `github.create_issue` / `create_issue_comment` / `update_issue` | all |
| Branches + commits | **git push with the shared vault token** (§5) — or the land-bot when Actions runs | all |
| Open PRs | `gh pr create` / `github.create_pull_request` on an existing branch | all |
| Merge PRs | `github.merge_pull_request` — after review evidence (§4, §6) | all |
| Commit `.github/**`, settings, break-glass fixes | lead only, via browser+PAT (LEAD.md) | R10 |

**The shared git token lives in the PRIVATE vault repo `I-am-drunk/linear-loops-vault`
(`GIT-TOKEN.md`)** — readable by every session via `github.get_content` (the connection
is workspace-public). It pushes branches and opens/merges PRs; it cannot touch `main`
directly (ruleset `main-pr-only`). It must never appear in this repo, any issue/PR,
chat, or transcript — this repo is public.

**If you think you need a browser or a credential: stop — you are doing it wrong. Ask on issue #2.**

## 1. Session start checklist (≈10 min, zero discovery)

1. Read `README.md` → this file → `work/STATUS.md` → the **current hub issue body**
   (gen-4: **#59**; the live number is pinned in `work/SWARM-STATE.md`) → your task issue.
2. **MCP playbook** (this cost prior generations hours — learn it once):
   - `github.*` calls failing `provider_unavailable` → pass `connectionId` explicitly on
     EVERY call; discover it via `connections.list()`.
   - `list_issue_comments` returns only the **oldest page** reliably — never page it.
     Canonical state lives in **issue BODIES**; full threads via
     `curl "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/<n>/comments?per_page=100&page=N"` (no auth).
   - `get_content` text caps at 50k chars → bulk-read via `git clone --depth 1` or
     `curl https://raw.githubusercontent.com/I-am-drunk/linear-loops-decompile/main/<path>`.
3. Register: comment on **issue #1**:
   `handle: agent-NN (gen 4) | session: <full sess_ id> | role RN | continuing T-xxx`
   — and the same line on the hub. #1 is write-only (you cannot read it back — paging);
   the lead mirrors live state into the hub body.
4. Claim ONE task (§2) before doing any work.

## 2. Claims (leases)

- Task board: `work/STATUS.md`; live mirror: the hub body (hub wins if they disagree).
- To claim: create issue **`[claim] T-NNN by agent-NN`** with JSON body
  `{"task":"T-NNN","lease_hours":6,"session":"sess_…","generation":4,"plan":"…"}`.
- Before claiming, `github.search_issues` for open `[claim]` issues on that task —
  a live lease wins. Lease expires at `claimed_at + lease_hours` (UTC, issue timestamp).
- Heartbeat: comment on your claim issue. Expired claims are free for anyone.
- **One live claim per session.** Release: comment `[release] T-NNN` on the claim issue.
- On reset: all leases die with their sessions. **Delivered work is never re-claimed** —
  the new generation continues it (RESET.md §5).

## 3. Publishing work — FILE blocks (durability rule, ABSOLUTE)

Code lives as FILE blocks on its task issue **the moment it works** — never only in a
sandbox, a cloud tree, or a transcript. gen-1 and gen-2 lost whole columns to dead
accounts; issue text survived three generations.

Format — each file in order:

    ### FILE: <repo-relative path>
    ```<lang>
    <content>
    ```

(fences of 4+ backticks when the content itself contains triple backticks)

- **One issue per task**: `[T-NNN] <title>` — the task's home forever.
- **Issues stay LEAN (v4.2, user-directed):** the issue body carries state, evidence
  summaries, decisions, and LINKS — not megabytes of code. Code's durable home is the
  **branch + PR** (they survive resets exactly like issue text). FILE blocks are the
  courier of last resort: put them INSIDE the `/land` comment itself and land
  immediately; the body keeps only an index (files, sizes, evidence, PR link).
- Put verification evidence above the blocks (`tsc` summary, test counts, Node version).
- **Latest-wins** on duplicate paths; write "supersedes" when replacing your own.
  Headers may carry a note — `### FILE: path (v2 — supersedes)` is legal.
- Workers can't commit `work/*` updates directly: stage the text on your task issue or
  the hub; the lead's truth pass lands it (or piggyback it on your own `/land`).

## 4. Review (buddy pairs)

No merge without **one review comment naming reproduced evidence** (fresh sandbox,
`bash ci/check-src.sh` output, test counts). Buddies: R2↔R5, R3↔R4, R6↔R9, R7↔R8,
R1↔R10; reserve/janitor reviews are additive. Bar: correctness vs SPECS, **originality**
(no transliterated Linear code — comment *what*, never *how their code looks*),
standalone typecheck.

## 5. Landing — `/land` (self-service, replaces the gen-1→3 integrator bottleneck)

Post on the task issue:

    /land branch=agent-NN/tNNN-slug from=#41,#43 pr="T-NNN: <title>"

- `branch` (required): `agent-NN/tNNN-slug`. Exists → files apply on top (multi-part
  packages: several `/land`s, same branch). Missing → created from `base=` (default main).
- `from=#N[,#M…]` (optional): land every FILE block from those issues — each issue's
  body first, then its comments oldest→newest, in the order given.
- Your `/land` comment's own FILE blocks apply **last** (inline corrections always win —
  e.g. the reads.ts export fix on #38).
- `pr="…"` (optional): open (or reuse) a PR to `base`.

The bot comments back the commit + PR link, or the exact rejection reason. Bot policy:
never commits to `main`; never writes `.github/**`; path allowlist `src/ work/ docs/
SPECS/ extracts/ pipeline/ ci/` and root `*.md`; caps 512KB/file, 2MB/bundle.
Bot pushes do **not** trigger CI (GitHub never cascades `GITHUB_TOKEN` events) — PR
review evidence is local reproduction (§4); the **merge to main does run CI**.

**If the bot is down** (e.g. the gen-4 billing lock): use the vault token (above) —
it is the everyday self-serve path; the bot is the zero-credential path once Actions
runs again. Lead break-glass (LEAD.md) is the last resort.

**Why the vault and not a token in these docs?** This repo is public: GitHub secret
scanning auto-revokes tokens committed to public repos within seconds, and anything
here is forever. GitHub's own secret stores (Actions/Environment secrets) are
write-only — agents can never read them back. The private vault repo is the only
GitHub-side store that is both access-controlled and agent-readable via the MCP.

## 6. Merging (any session, after review)

`github.merge_pull_request(number, method:"squash")` once §4 is satisfied and
`github.get_pull_request` shows `mergeable`. Then note it on the hub; the lead's truth
pass updates `work/STATUS.md` + `work/LOG.md` + closes the task issue. Merge blocked or
conflicting → post on #2; never force anything.

## 7. Canonical state & the hub

- **Live truth: the current hub issue's BODY** (gen-4: #59), maintained by the lead.
- `work/*.md` = the lead's checkpoint, refreshed at merge sweeps. Hub body wins
  disagreements; issue text wins over memory; you have no memory tomorrow.
- Threads: roster #1 (write-only) · help #2 · golden goose #14 · UI bar #20.
- Runner-side `sessions.send_message` = pager for interrupts only; mirror decisions here.

## 8. Roles & duties

Per `ROLES.md`. **R10 (lead)** is a duty set, not a power: hub body, truth passes,
claim sweeps, PR audit (the legal line, §9), `.github/**` gatekeeping, tie-breaks.
Everything else, every session can do. LEAD.md holds the break-glass browser
procedure (vault rotation, `.github/**`, settings — the only browser jobs).

## 9. Hard rules (absolute)

- **Never commit Linear-proprietary material** (bundle/DMG/asar/prettified chunks). The
  repo is **PUBLIC** (user decision 2026-09-26) — every commit and comment is forever.
  `extracts/` = facts only.
- All reimplementation code is **original**.
- **Credentials never** in repo/issues/chat/cloud/transcripts. v4 sessions need none (§1).
- One live claim; heartbeat or it expires. Small frequent updates beat big silent pushes.

## 10. Generations — serial AND concurrent (v4.3)

Sessions die; handles (`agent-NN`) and issue text survive. Registry: `work/EPOCHS.md`.
A **generation = one Runner-account lifespan of the fleet.** Generations may
**OVERLAP**: when the user starts a new account before the old one's credits die, both
fleets run and claim at once. That is normal, and five rules cover it:

1. **Identity is `agent-NN@genN`.** During overlap every registration, claim, review,
   and hub line carries the generation. New branches are named
   `gen<N>/agent-NN/tNNN-slug` (unprefixed branches from earlier generations stay).
2. **Claims are generation-blind.** A claim is live iff its lease is unexpired with a
   fresh heartbeat — no matter which generation holds it. Earliest claim wins a free
   task (§2). Dead account ⇒ heartbeats stop ⇒ leases void on expiry; once the user
   confirms the death, the lead voids that generation's claims on the hub immediately
   rather than waiting for expiry.
3. **The pen.** The hub body and `work/*` files have ONE writer: the lead of the
   OLDEST LIVING generation. It passes to the next generation's rank-0 at the
   tombstone. Registrations (comments on #1 + the hub) are append-only — any
   generation, any time.
4. **Tombstone.** When a generation's account is confirmed dead, any living lead
   appends its EPOCHS row + hub line and voids its claims. The living generations
   continue — zero downtime, no special reset prompt (FLEET-PROMPT covers both cases:
   full-fleet boot and joining a running generation via its backstop).
5. **One live hub.** Overlapping generations share the current hub issue. A new hub
   opens only when the pen-holder judges the current one unwieldy (~150+ comments).

**When to boot the next fleet: whenever** — as soon as credits look thin, or earlier.
There is no wrong time; the rules absorb the overlap. Boot text:
`work/FLEET-PROMPT.md` (generation-agnostic). Handle/role assignment: self-derived
(FLEET-PROMPT STEP 0) — **no rank math by hand, no user-side assignment** (gen-2/3
lost hours to collisions).
