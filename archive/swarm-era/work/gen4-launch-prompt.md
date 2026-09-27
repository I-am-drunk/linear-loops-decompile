# gen-4 launch prompt — RETIRED 2026-09-27

Superseded by `work/FLEET-PROMPT.md` — the ONE boot text for every generation and
every fleet size. Gen-specific launch prompts are a bug class: this file named a
generation ("gen 4"), a fixed worker count ("9 worker sessions (agent-02…10)"),
a hub number, and a task-state snapshot — all stale within hours. Worse, its
rank→handle table reassigned slots the live 05:06Z fleet already held
(agent-02/03/04), and its "lowest unregistered handle" backstop produced a
duplicate agent-05 within minutes of the 06:07Z boot (post-mortem:
COORDINATION.md §11 + the hub, 2026-09-27).

Use `work/FLEET-PROMPT.md` for every boot. Full history: git.
