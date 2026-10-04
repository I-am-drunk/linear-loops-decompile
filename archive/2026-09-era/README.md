# The 2026-09 era

Three eras of this project ran from 2026-09-26 to 2026-09-30: a swarm build, a
harness rebuild, and an assembly track. `docs/LEARNINGS.md` is what they were
for — read that.

## Why there is no detailed digest here

A peer session compiled an excellent per-issue digest of all 121 issues and
both mega-threads, and the first draft of this rearchitecture committed it
verbatim. It was removed in review, correctly: the digest was dense with
corpus-derived internals — minified identifiers, chunk line offsets, exact
validation error strings, constant tables, algorithm transcriptions — which is
precisely the material `docs/PROVENANCE.md` says we do not publish.

Writing a rule and then committing a file that breaks it in the same PR is the
exact inconsistency the rule exists to catch, so the file goes and the rule
stands. Credit to that session's work: the dispositions in `docs/LEARNINGS.md`
and the issue closures on the board both follow it.

## What survives

- `docs/LEARNINGS.md` — the three eras, what went wrong, and the technical
  findings worth keeping, stated at a level that does not transcribe anything.
- The closed issues themselves, each with a disposition comment.
- `swarm-era/` — the first era's coordination docs, which are our own writing.
- Code: `archive/v0-swarm-era` and `archive/r3.4-ui-shell` as git tags.
