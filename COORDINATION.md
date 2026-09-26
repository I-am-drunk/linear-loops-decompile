# Coordination protocol

~10 sessions, no shared memory, no subagents. The repo is the only shared state.
Everything here is designed around what each session can actually do:

| Capability | Workers (roles 1–9) | Integrator (role 10) |
|---|---|---|
| Read repo (github.get_content) | ✅ | ✅ |
| Create issues + comments | ✅ | ✅ |
| Create PRs (existing branches) | ✅ | ✅ |
| Commit files / merge PRs (browser GitHub, user is logged in) | ❌ | ✅ |

Because only the Integrator can commit, **work products travel as labeled code blocks in
issue comments**, and the Integrator lands them. (If a worker's MCP can also create
branches+commits, it may open real PRs instead — same review flow.)

## 1. Session start checklist

1. Read `README.md`, this file, `work/STATUS.md`, `ROLES.md`.
2. Comment on issue #1 (Roster): handle `agent-NN`, role #, one-line plan.
3. Claim a task (§2) before doing any work.
4. Re-read `work/STATUS.md` + `work/LOG.md` at the start of every work block. Files win
   over your memory — you have none tomorrow.

## 2. Claims (leases)

- Tasks live in `work/STATUS.md` with IDs like `T-203`.
- To claim: **create issue titled `[claim] T-203 by agent-NN`** with body
  `{"task":"T-203","lease_hours":6,"plan":"…"}` — OR, if you can commit, create
  `work/claims/T-203.md` with the same JSON. Issues are the fallback claim channel;
  the Integrator mirrors them into `work/claims/`.
- A claim is **live** until its lease expires (`claimed_at + lease_hours`, UTC, from the
  issue's timestamp). Heartbeat = comment on your claim issue (or edit the claim file).
  Expired claims are free for anyone, including re-claim by the same agent.
- **One live claim per session.** Finish or release before claiming again.
- To release: comment `[release] T-203` on your claim issue and note it in `work/LOG.md`.

## 3. Publishing work (workers)

1. Open (or reuse) **one issue per task**: `[T-203] <title>`. This is the task's home.
2. Post deliverables as comments, each file in its own fenced block with a path header:

   ````
   ### FILE: src/engine/scheduler.ts
   ```ts
   …content…
   ```
   ````

   Long files: split across sequential comments `FILE: path (part 1/3)` — do not truncate.
   Binary assets: describe them + attach via the issue UI if your tooling allows; otherwise
   flag for the Integrator.
3. When done: comment `[ready] T-203` with a commit message suggestion and file list.
4. The Integrator commits, closes the issue, updates `work/STATUS.md`, `work/LOG.md`.

## 4. Publishing work (Integrator)

- Commit directly (github.dev web editor works well for multi-file batches).
- Message style: `T-203: <what> (agent-NN)`. Credit the author.
- Keep `work/STATUS.md`, `work/LOG.md`, `work/claims/` and `work/ROSTER.md` truthful —
  you are the janitor. Sweep expired claims when you see them.

## 5. Questions & blockers

- Question about a domain → comment on the task issue; prefix `@role-N` to address someone
  (they check mentions when they sweep issues).
- Blocked → mark the task `blocked` in `work/STATUS.md` (via your task issue) with the
  reason, release the claim, take another task.
- Cross-session messages → `work/inbox/<handle>.md` (integrator-maintained) or issue mentions.

## 6. Conflicts

- Two live claims on one task → earliest timestamp wins; the later one releases.
- Contradictory edits → the file in the repo wins; argue on the task issue, Integrator
  decides ties, decision recorded in `work/LOG.md`.

## 7. Definition of done (any task)

- Deliverable committed under `src/` or `SPECS/` per the role contract.
- If it's code: it typechecks/builds standalone (`tsc --noEmit` or the package's build).
- `work/STATUS.md` row updated, `work/LOG.md` entry added, task issue closed.
