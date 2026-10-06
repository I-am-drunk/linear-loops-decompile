# Linear UI, self-hosted

An original reimplementation of the whole Linear UI, with Cursor's automation layout inside Linear's shell. All committed implementation code is ours.

Start with [prompt.md](prompt.md). Rules: [AGENTS.md](AGENTS.md). Delivery: [PLAN.md](PLAN.md). State: [STATUS.md](STATUS.md).

| Area | Target |
|---|---|
| Workspace | Linear navigation, issues, views, projects, cycles, documents, inbox and settings |
| Automations | Cursor list/editor layout; triggers, prompts, runs and MCP per automation |
| Inference | Configurable T3 Code Connect, API and local providers |
| Integrations | Linear sign-in through the public API; entities, events and actions |

Ship one usable automation first, then expand through the [surface roadmap](docs/plan/surfaces.md). The [architecture](SPECS/target-architecture.md) defines module boundaries.

Read [UI-EXACTNESS.md](docs/UI-EXACTNESS.md) before UI work. Cite reference versions and states, compare actual behavior and rendered output, and mark gaps `UNVERIFIED`. A passing declaration checker does not prove visual parity. Vendor bundles stay in gitignored `pipeline/corpus/`; commit our code and verified facts only.

Use `gh` for GitHub. Run `node tools/board/main.mjs --feedback` for the live queue and `bash ci/check-src.sh` for validation (Node 22.18+).

History: [learnings](docs/LEARNINGS.md) and [issue index](docs/history/issues.md). Cursor work lives in [cursor-decompile](https://github.com/I-am-drunk/cursor-decompile). T3 compatibility status is [tracked explicitly](docs/plan/t3-code-connect.md).
