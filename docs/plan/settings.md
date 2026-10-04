# Settings

Linear's settings UI is the visual model, because the owner likes how it looks
and it is a genuinely good pattern: a left nav of sections, a single-column
content area with a page title, and grouped rows where each row is a label, a
description, and one control on the right.

We build that pattern as our own components. It is a layout idiom — nav plus
titled sections plus labelled rows — not a transcription.

## Sections

| Section | Contains |
|---|---|
| Workspace | name, logo, deployment URL |
| Account | the signed-in user, theme |
| **Inference** | provider list, add/edit/test — `inference.md` |
| **Integrations** | connected services, connect/disconnect — `integrations.md` |
| **MCP servers** | the workspace server registry — `mcp.md` |
| Automations | workspace defaults: timezone, retention, concurrency |
| Members | users, if the deployment has more than one |

Inference, Integrations and MCP servers are the three that matter; the rest are
chrome we need for the shell to feel complete.

## Row patterns

Five, and everything is one of them: **toggle**, **select**, **text input**,
**credential** (write-only, shows presence and a masked hint, never the value),
and **connection** (status badge plus a connect/disconnect/test action).

Getting these five right early means every later settings page is assembly.

## Theme

Dark and light, token-driven. Tokens are defined once and consumed by
component; no component hardcodes a color. The existing `src/ui-theme` module
generates the token set and is golden-tested — it carries over.

## Slices

| Slice | Scope | Depends on |
|---|---|---|
| ST1 | settings shell: nav, page frame, section routing | app shell |
| ST2 | the five row patterns as components | ST1 |
| ST3 | Inference section | ST2, IN1 |
| ST4 | Integrations section | ST2, IG1 |
| ST5 | MCP servers section | ST2, MCP1 |
| ST6 | Workspace / Account / Automations sections | ST2 |
