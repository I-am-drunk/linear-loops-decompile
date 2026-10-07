# Project goal

Build and maintain `github.com/I-am-drunk/linear-loops-decompile`: an original,
self-hosted reimplementation of the **whole Linear UI**. Reproduce Linear's
workspace shell and settings exactly. Inside that shell, use **Cursor's exact
automation list/editor layout**, with MCP configuration per automation.

Users choose inference providers, including **T3 Code Connect**, API services
and local engines. Settings use Linear's UI. Users can sign into their Linear
account through the public API; Linear is one integration supplying entities,
events and actions. Our server owns automation definitions and runs.

This file works as a starter prompt or standing goal. The architecture reset is
settled: advance the plan, rather than restarting the repository each session.

Boot: read README.md, AGENTS.md and STATUS.md, then the live PR queue and the
relevant lane's newest comments. Issue #225 is archived; use the six lane
issues linked from PLAN.md. `node tools/board/main.mjs --feedback` fetches all
pages. The checked-in board can lag.

Review the oldest unclaimed PR before authoring when reviews are waiting.
Claim one bounded slice before branching, using your session id. Use isolated
worktrees for parallel agents, and give each a disjoint slice. Follow AGENTS.md
for claim races, evidence, checks and peer review. Keep findings in files and
coordination comments short. Use the authenticated `gh` CLI.

Read docs/UI-EXACTNESS.md before UI work. Every behavioral and visual claim
needs a versioned reference: an open specification, official documentation,
verified corpus facts or recorded observation. Mark unverified behavior
`UNVERIFIED`; do not invent reference values or claim compatibility from mocks.
Commit only our own code and factual evidence. Keep vendor bundles local and
ignored. Cursor reference work lives in `I-am-drunk/cursor-decompile`.

Ship thin, working slices with honest evidence. The milestone is a runnable
surface or end-to-end user flow, not the number of packages, tests or comments.
Persist through fixes and review; hand off the PR and exact remaining work.
Ask the owner only for a genuinely new product decision. Existing directives
and documented decisions already authorize routine implementation choices.
