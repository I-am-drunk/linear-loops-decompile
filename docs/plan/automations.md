# The automations page

Our centrepiece. It replaces Linear's Loops layout with Cursor's automations
layout, because that layout is better for this job.

## Why not Linear's

The owner's directive: build the automations page on Cursor's layout rather
than Linear's Loops layout, because the features they want are in the former.

Being honest about what is established and what is not — the feature
comparison in the first draft of this doc was asserted without evidence, which
is the failure mode `AGENTS.md` names:

| Capability | Status |
|---|---|
| per-automation tool/MCP selection | Cursor's automations docs describe tool selection. Our design is built from the MCP spec regardless, so this does not depend on the comparison. |
| multiple triggers per automation | Cursor's docs describe multiple triggers. |
| prompt chaining | `UNVERIFIED` as a Cursor claim. The owner asked for it; we build it because it is wanted, not because a competitor has it. |
| per-step model choice | `UNVERIFIED` as a Cursor claim. Same: it follows from chaining plus a provider registry. |
| what Linear's Loops does or does not offer | `UNVERIFIED`. Not needed — the directive is to build this shape, and we do not have to prove the alternative is worse. |

The design below stands on its own merits. Nothing in it requires the
comparison to be true, which is why the unverified rows can stay unverified
instead of being quietly upgraded to justify a decision already made.

## Shape

Two surfaces: a **list** and a **detail/editor**.

**List.** One row per automation: name, enabled state, the model it runs, who
created it, its tools. Enabled rows sort before disabled. Search and filter
across the set. Row actions: edit, duplicate, copy as JSON, delete (with
confirmation). An empty state with a title, a description, and one button.

**Detail.** Stacked sections, each independently editable:

| Section | What it configures |
|---|---|
| Triggers | one or more; see below |
| Prompts | the prompt, or a chain of them |
| Tools | MCP servers and built-in actions — see `mcp.md` |
| Environment | repo / branch / scope the automation runs against |
| Memories | notes the automation accumulates across runs |
| Parameters | typed inputs: boolean, enum, free text |

Sections are a registry, not a hardcoded sequence, so a feature adds a section
without touching the page.

## Triggers: many, not one

An automation holds a **list** of triggers, any of which fires it. Each trigger
is a kind plus that kind's options. Kinds we ship:

- **Schedule** — cron, with presets and a custom editor. Our clock, our
  scheduler. Built from the public cron specification: five fields and the
  day-of-month/day-of-week OR rule are POSIX; `@daily`-style nicknames are a
  Vixie extension, not portable POSIX syntax, so a schedule that uses one is
  ours to expand rather than something every cron accepts.
- **Integration event** — something happened in a connected service. For
  Linear: an issue changed, a project updated. Delivered by webhook where the
  integration offers one, polled where it does not.
- **Manual** — a run button.
- **Webhook** — an inbound URL we generate, with an allowlist.

Duplicate triggers are rejected: same kind plus same options is the same
trigger.

## Prompt chaining

A prompt is either a single prompt or an ordered chain of steps. Each step has
its own text and **its own model**, because the cheap model is right for step
one and the expensive one for step three. Later steps see earlier output.
Reorderable, with add and remove.

This is the feature that makes per-automation model choice matter, and it is
why the inference provider registry (`inference.md`) is a dependency rather
than a nicety.

## Runs

A paginated feed per automation: status, when, duration, cost, and the
transcript. Our server serves it — run state is ours entirely, since no public
API exposes automation runs. Statuses: queued, running, succeeded, failed,
cancelled.

## What we do not do

No collaborative editing of drafts. No credit metering — self-hosted has no
billing to meter. No run retention policy beyond a configurable prune.

## Slices

| Slice | Scope | Depends on |
|---|---|---|
| AU1 | list page: rows, sort, empty state, search | app shell |
| AU2 | detail frame: section registry, save/dirty | AU1 |
| AU3 | triggers: schedule + manual | AU2 |
| AU4 | prompts: single, then chain | AU2, inference registry |
| AU5 | tools: MCP section | AU2, `mcp.md` |
| AU6 | runs feed + transcript | AU2 |
| AU7 | environment, memories, parameters | AU2 |
