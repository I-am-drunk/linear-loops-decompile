# PLAN

Six lanes. Each has a design doc in `docs/plan/` and an issue on the board.
Lanes run in parallel; slices within a lane are ordered.

| Lane | Doc | What |
|---|---|---|
| **SH** shell | — | app shell: router, nav, theme, layout primitives |
| **ST** settings | `plan/settings.md` | Linear-style settings UI |
| **IN** inference | `plan/inference.md` | provider registry; T3 Code Connect first-class |
| **IG** integrations | `plan/integrations.md` | integration interface; Linear as one |
| **AU** automations | `plan/automations.md` | the automations page, Cursor layout |
| **MCP** mcp | `plan/mcp.md` | MCP per automation |

## Order

**Milestone 1 — a usable automation.** Create a scheduled automation with a
prompt, pick a model, run it, see the transcript.

```
SH1 shell + router + theme
SH2 layout primitives
ST1 settings shell ──┬── ST2 row patterns ──┬── ST3 inference section
IN1 provider registry┘                      │
IN2 openai-compatible adapter               │
AU1 list page ── AU2 detail frame ── AU3 schedule trigger
                                  └─ AU4 prompt + model
                                  └─ AU6 runs feed
```

**Milestone 2 — tools.** `MCP1`→`MCP5`, `ST5`, `AU5`. An automation that calls
an MCP server.

**Milestone 3 — Linear.** `IG1`→`IG6`, `ST4`. Sign in, read the workspace,
trigger on issue events, write back.

**Milestone 4 — breadth.** Prompt chaining (`AU4` full), `IN3`/`IN4`,
parameters and memories (`AU7`), more integrations.

## Dependencies worth knowing

- **The shell blocks all UI.** `SH1`/`SH2` are the foundation slices; they get
  extra review because every later slice copies their patterns.
- **The node/markdown render tier is shared** by the prompt editor and the run
  transcript. Build it once, early, not twice.
- **`IN1` before `AU4`** — prompt config needs the model list.
- Lanes `IG` and `MCP` are independent of each other and of `AU` past `AU2`.

## Carried forward

Kept from earlier eras: `src/server` (transport, boot, settings RPCs,
rate-budget Linear client), `src/model`, `src/ui-theme`, the presentation
kernels under `src/ui-*` and `src/*-kernel`, `pipeline/`, `tools/coverage`.
Retired: the 60/40 effort split, the golden-count meter, "EXACT REPRODUCTION"
as the bar, the mega-thread. See `docs/LEARNINGS.md`.
