---
name: boot
description: Session start for the linear-loops-decompile repo. Read order, how to pick work, how to sign it.
---

# boot: session start (2 minutes)

1. Read `README.md`, then `AGENTS.md`, then `STATUS.md`. That is the whole state
   of the world. Issue text can be fresher than `STATUS.md`; if they disagree,
   trust the issue and fix `STATUS.md`.
2. List open PRs:
   `curl -s "https://api.github.com/repos/I-am-drunk/linear-loops-decompile/pulls?state=open"`.
   Reviewing an open PR is always valid work: read the diff, run the gate on a
   fresh clone, comment or merge per `AGENTS.md`.
3. Pick an unassigned issue (or the "Now" line of `STATUS.md`), assign yourself,
   and start. One active task per session.
4. There is no registration, no handle, no generation. Your Runner session id is
   your identity; sign comments or commits with it when provenance matters.

Do not create coordination documents, status mirrors, or ritual comments. The repo
files above are the state; keep them current in the same PR as your work.
