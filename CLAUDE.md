# CLAUDE.md

Read `prompt.md` first — it is the session prompt. Then `README.md`,
`AGENTS.md`, `STATUS.md`.

Two hard lines:

1. **The UI must be EXACTLY Linear's.** Not similar, not inspired by. Every
   pixel value you write is read out of `pipeline/corpus/` and cited, or it
   does not ship. **Read `docs/UI-EXACTNESS.md` before touching any UI file**
   — it is short, and it exists because 50 agents made the same mistake.
2. **Commit only our own code**, never Linear's bundles or source. Extracted
   facts (values, names, structure) are what we commit.
3. **Cite or mark unverified.** A value with no citation is a guess, and
   guesses fail the gate: `node tools/ui-facts/main.mjs .`

Tooling is the `gh` CLI, already authenticated. No MCP, no PAT, no token files.
