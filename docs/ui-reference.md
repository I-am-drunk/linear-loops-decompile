# UI reference: extracted design facts (Linear v1.32.4, 2026-09-27)

The fidelity reference for the rebuild. Facts extracted from the corpus; our CSS
is original. When a value is not yet extracted, mark it UNVERIFIED instead of
guessing (AGENTS.md hard rule).

## Sources (regenerate after each corpus refresh)

- `pipeline/corpus/style/style-*.css`: the compiled client stylesheet
  (~565 KB, lightningcss output with light/dark switches).
- `pipeline/corpus/pretty/client/*.js`: component code; `*.stylex.*.js` chunks
  hold per-module style constants.
- Theme tokens are injected at runtime by a `:root` builder in the Root chunk;
  the full custom-property namespace is mineable per component as needed.

## Typography (extracted)

- UI font: `"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue",
  "Linear Thai", sans-serif`
- Mono font: `"Berkeley Mono", "SFMono Regular", Consolas, "Liberation Mono",
  Menlo, Courier, monospace`
- Base size: Linear's UI runs small and dense (13px class); exact scale per
  component: UNVERIFIED, extract per component during implementation.

## Core dark palette (extracted anchors)

| Token | Value | Evidence |
|---|---|---|
| App background | `#08090a` | compiled CSS |
| Raised surface | `#111113` | compiled CSS |
| Brand indigo | `#5e68d0` | compiled CSS |
| Link blue | `#4ea7fc` | compiled CSS |
| Success | `#3fb950` | compiled CSS |
| Error | `#f85149` | compiled CSS |
| Subtle border | `#ffffff14` (white 8%) | compiled CSS |
| Primary text | `#e8e3e3`-class off-white | compiled CSS |

## Layout

- Content max width: `80ch` (LayoutConstants.stylex).
- Sidebar width: UNVERIFIED (extract during the R8 verification pass).
- Copy tone (SPECS/loops.md): terse, sentence case.

## Method note

StyleX compiles to atomic classes with hashed custom properties, so there is no
single theme object to copy; values are mined per component. That keeps us on the
right side of the legal line automatically: we extract facts (values, structure)
and write original CSS.
