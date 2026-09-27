# EPOCHS — generation registry (rule + write-once records, NEVER live state)

> **Never-stale by design (v4.6, user-directed 2026-09-27).** Every earlier edition
> of this file tried to mirror the living fleet — rosters, "current" rows, per-slot
> statuses — and was wrong within hours, every time. Live fleet state has exactly
> two homes, both self-updating: the **registration log (issue #1**, append-only,
> permanent) and your own **`sessions.list`** (account-local, always current). This
> file keeps only (1) the derivation rule and (2) write-once birth/death records.
> **The records are an audit trail, never an input to identity.** If a record ever
> disagrees with the derivation, the derivation wins and the record is repaired at
> the next tombstone.

## 1. Derive your generation — 30 seconds, no docs PR ever needed

Inputs: the tail of issue #1
(`curl -s "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/issues/1/comments?per_page=100&page=N"`, page to the end)
and your own `sessions.list`.

1. A **registration** is a #1 comment of the form
   `handle: agent-NN (gen N) | session: sess_…`.
2. A registration is **OF YOUR FLEET** iff its sess_ id appears in YOUR
   `sessions.list`. Session ids are per-account: another account's fleet can never
   appear in your list. That single test is the entire account anchor (v4.5) —
   there is no roster to maintain because the account boundary maintains itself.
3. **Your generation = the highest N that has ≥1 registration OF YOUR FLEET.**
4. If there is none — fresh account, or the account's previous fleet is gone from
   the list (reset/voided: **a same-account reboot is the NEXT generation**, v4.6,
   not a continuation) — then you are **G_max + 1**, where G_max is the highest
   gen number ever declared on #1 by anyone. The first registration to declare
   the new number establishes it; same-boot siblings see it within seconds and
   join it (step 3).
5. **Two fresh fleets declare the same number** (parallel boots, the gen-4
   incident): the declaration with the LOWEST comment id keeps it; the other
   fleet increments and posts a one-line correction. Comment ids are a total
   order — no arbitration, no user needed. Claims are generation-blind
   (COORDINATION §10.2), so no work is ever lost to a renumbering.
6. The 1-hour-silence rule (COORDINATION §11) governs **handle slots inside**
   your generation — never generation membership. A quiet hour costs a handle,
   not a generation.

That is the whole algorithm. No "current" row to keep fresh, no row to open at
boot, no rank math, no user-side assignment.

## 2. Birth & death records (write-once)

- **Birth:** a session of the new generation adds ONE line — gen number, account
  marker (boot-batch sess_ prefixes), boot time, declaring #1 comment. Never a
  roster: the roster lives on #1 and goes stale anywhere else.
- **Death:** when a generation is confirmed dead — its sessions gone from every
  account you can see AND silent past the 1-hour rule, or an explicit user void —
  any living lead compresses its line into a tombstone: cause, what it delivered,
  what was in flight at death. Tombstones are append-only history; edit only to
  compress.
- **You cannot tombstone another account's generation.** Overlap (§10) means
  "gone from MY sessions.list" ≠ dead. Record only what you can verify.

| gen | account marker (boot-batch sess_ prefixes) | born (UTC) | record |
|---|---|---|---|
| gen-1 | sess_01a0dfb8 / 9 / bb | 2026-09-26 | **DEAD** (account credits). Delivered T-101 (#30), T-201 (#24), T-301 v2 + T-302 (#26), T-601/602 (#25/#27). Cloud-staged work lost at death — the event that created the FILE-block durability rule. |
| gen-2 | sess_01a0dff7…dffa | 2026-09-26 | **DEAD** 09-27 ~00:37Z (account credits). Landed reset docs (0ab2353) + branches c725991 / ec5d083 / 2eba6d4. Protocol v3. |
| gen-3 | sess_01a0e04a…e04f | 2026-09-27 00:37Z | **DEAD** ~02:00Z (account credits, mid-landing). **Nothing lost** — the full queue was FILE-blocked and validated 203/203 at 01:57Z. Its rank-collision post-mortem produced v4.4 claimed identity. |
| gen-4 | other account: sess_01a0e088 / e08c / e141 / e142 — two boots (02:36Z + 05:06Z), ONE generation per v4.5 | 2026-09-27 02:36Z | **DEAD** (account replaced mid-M5, user-confirmed ~06:4xZ; tombstone by agent-01@gen5). Landed the entire M1–M4 queue (PRs #47–#73, 237/237 fresh-clone); its M5 PRs #81 + #83 were merged by gen-5 at 07:08Z. Permanent legacy: protocol v4 / v4.2, vault-token commits, land-bot, main-pr-only ruleset, two-source cross-check, hub #59. Live claims #74/#75 voided at death. |
| gen-5 | sess_01a0e17b / e179 | 2026-09-27 06:07Z | **LIVING** (parallel account — its sess_ ids are not in the gen-6 account's sessions.list, which under §1 step 2 makes it a distinct generation; active ≥07:18Z: PR #98 truth pass + hub #59 pen). Declared per v4.5 correction (#1 comments 5853502349 / 5853573240). Holds the pen as oldest living generation (§10.3). |
| gen-6 | sess_01a0e1ae / e1b0 | 2026-09-27 07:05Z | **LIVING.** Established user-directed 2026-09-27 ("you should be v6" — the 07:05Z fleet derives no gen-5 registration of its own fleet, so §1 step 4 → G_max+1). First declarations: #1 comments 5853656413 (agent-01), 5853679389 + 5853709067 (agent-02, after §11 confirm-and-yield). Roster: derive from #1 — never listed here. |

## 3. Conventions that survive every generation

- Cross-generation reference: `agent-NN@genN`. During overlap, new branches are
  `gen<N>/agent-NN/tNNN-slug`; unprefixed historical branches stay as they are.
- **The pen** (hub body + `work/*` truth passes): the lead of the OLDEST LIVING
  generation (COORDINATION §10.3). Registrations and comments are append-only —
  any generation, any time.
- A dead generation's session ids are VOID — never trust them, never reuse them.
- When a generation dies with live claims, the living lead voids them on the hub
  immediately (§10.2) rather than waiting out the leases.
- This file's older editions (per-slot rosters and final states for gen-1…gen-5)
  live in git history. They were the stale class this edition exists to kill.
