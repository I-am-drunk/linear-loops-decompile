# Provenance: how we get our facts

This repo is public. What we commit has to be ours.

## The rule

**Do:** read Linear's and other shipped apps' bundles locally to understand
how something behaves. Build from open specifications (MCP, cron, OAuth,
GraphQL), from public documentation, and from the product as a user sees it.
Cite what you relied on.

**Do not:** commit vendor material, or a transcription of it. No bundles, no
decompiled or prettified source — and no fact table that reproduces a
surface's internals at byte fidelity: every copy string, prop name, CSS class,
validation regex and feature-gate default, cited to line numbers in a
decompiled artifact. That is the same substance in a different shape.

A `.gitignore` on the artifact does not fix this. If the bundle stays local
while its distilled contents ship publicly, the structure protects the
container and publishes the substance.

## Why the rule is written this way

2026-10-04. Seven subagents were pointed at Cursor's
`workbench.anysphere-ui-automations.js` with a brief that said "facts only,
never paste vendor code" and told them to write fact tables into a public
repo. Six refused, independently, and converged on one objection: the
no-code-pasting rule shaped the format while the brief asked for the full
substance, and the gitignored-artifact/public-facts split published the
derived material without its provenance. They were right. The brief was the
defect.

The same critique applies to this repo's own earlier method, which described
itself as "EXACT REPRODUCTION, not clean-room" and treated behavior, values
and algorithms as unconditionally fair game. The distinction between an idea
and its expression is real, but a document specifying every string and every
branch has crossed it.

## It also produced worse facts

The one extraction that completed checked our own queue and found 3 of its 4
headline copy strings wrong: `All Automations` is a radio item in a *runs*
filter, not the list header; `Add Automation` is never rendered (it is a
sentinel rewritten to `New Automation`); there is no trigger-summary cell and
no last-run cell. The queue had been written from guesses *about* the artifact
and then cited as if verified. High-fidelity extraction produces confident,
cited, wrong facts as readily as right ones — and it is slower than reading
the public spec.

## What this changes in practice

| Was | Is |
|---|---|
| Decompile the bundle, transcribe its internals, publish the tables | Read locally to understand; build from open specs and the visible product |
| "Exact reproduction" of values and algorithms as the bar | Behavioral parity where a user can see it; cite the open source of truth |
| Corpus chunk as the citation of record | Public spec, public docs, or observed behavior |
| Unverifiable claims padded to look sourced | Marked `UNVERIFIED`, or left out |

Private reading tools are fine and useful: they commit no vendor bytes and
they stay local. The sibling `cursor-decompile` repo keeps two
(`pipeline/split.mjs`, `pipeline/names.sh`) and nothing else.

## If you think a case is different

Say so in the PR and let the owner decide. Interoperability work, wire-format
compatibility, and security analysis are legitimate and differently situated.
"We need it to match exactly" is not, by itself, a reason.
