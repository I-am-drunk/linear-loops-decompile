# Product contract

The owner has settled these requirements:

- Reimplement the **whole Linear UI**, including general workspace navigation,
  issues, projects, cycles, documents, inbox and Linear-style settings.
- Use **Cursor's automation layout** inside the Linear shell. Provide MCP per
  automation, triggers, model selection, prompts and run inspection.
- Make inference configurable, including T3 Code Connect and API/local providers.
- Allow Linear sign-in as one integration; our server owns automations and runs.
- Keep all implementation original. Verify parity from cited evidence.

PLAN.md stages this scope; later milestones remain in scope. A reference gap
is UNVERIFIED work to resolve, not authorization to substitute a guessed UI.
The automation page's Cursor layout is the explicit exception to Linear layout.

SPECS/target-architecture.md defines module boundaries. docs/UI-EXACTNESS.md
defines evidence. docs/plan/decisions.md separates owner decisions from defaults.

Earlier Loops-only, primary-Linear-chat and fixed effort-split instructions are
historical. They are preserved under archive/2026-09-era/specs/ for context and
do not govern current work.
