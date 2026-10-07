# UI reference: extracted design facts (Linear v1.32.4, 2026-09-27)

The fidelity reference for the rebuild. Facts extracted from the corpus; our CSS
is original. When a value is not yet extracted, mark it UNVERIFIED instead of
guessing (AGENTS.md hard rule). This revision replaces the R3.4-era hand-mined
anchors per the audit (docs/audit-2026-09-27.md, verdict: REWRITE) and feeds the
theme-token family of the parity harness (issue #162).

## Sources (regenerate after each corpus refresh)

- corpus chunks `lightThemeRefresh` + `ThemeHelper` (hashes rotate per
  deploy — grep the name, never cite the hash): Linear does NOT ship a static theme table — themes
  are GENERATED at runtime by `generateTheme({ base, accent, contrast,
  colorFormat })` from OKLCH-style `[lightness, chroma, hue]` triples.
  `rootPreReactTheme.DBv2K1Bx.js` picks dark vs light by the `dark` class on
  `<html>`. The four built-ins (bundler export name → role):

  | export | role | base | accent | contrast |
  |---|---|---|---|---|
  | `r` | **default dark** | `[5.52, 0.4, 272]` | `[47.9175…, 59.3027…, 288.4214…]` | 27 |
  | `t` | **default light** | `[97.94, 0.5, 282]` | `[53, 52.26, 286.91]` | 30 |
  | `i` | dark, high contrast | `[8, 0.75, 272]` | `[47.917542332560124, 59.30267706856808, 288.42138382943733]` | 90 |
  | `n` | light, high contrast | `[98.7, 0.5, 282.8634…]` | `[53, 52.26, 286.91]` | 90 |

- The tables below were produced by EXECUTING the corpus generator with those
  parameters (`node` on the two chunks, sandbox only) and recording the output
  values. Values are facts; generator code stays in the vault, never committed.
  The exact reimplementation of `generateTheme` (audit Finding 1
  recommendation) can be verified token-for-token against these tables.
- `pipeline/corpus/style/style-*.css`: the compiled app
  stylesheet (~565 KB lightningcss output) for font stacks and global rules;
  note it declares the `--sx-*` theme custom properties EMPTY — values are
  injected at runtime from the generated theme, which is why hand-mining the
  CSS produced wrong anchors.
- `pipeline/corpus/pretty/client/*.js`: component code; `*.stylex.*.js` chunks
  hold per-module style constants.

## Typography (extracted)

- UI font: `"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont,
  "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue",
  "Linear Thai", sans-serif` (exposed as `--font-regular`)
- Mono font: `"Berkeley Mono", "SFMono Regular", Consolas, "Liberation Mono",
  Menlo, Courier, monospace` (`--font-monospace`)
- Emoji: `"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI",
  "Twemoji Mozilla", "Noto Color Emoji", "Android Emoji"` (`--font-emoji`)
- Body rules: `line-height: 1.5`; grayscale/antialiased font smoothing;
  `user-select: none; cursor: default` on body; `text-size-adjust: 100%`.
- Sizes seen in the compiled CSS: 11/12px labels, 13px (0.8125rem) inputs and
  primary UI text, 14/15px titles, 1.25–1.5rem page headings. Exact per
  component mapping: extract per component during implementation.

## Theme tokens (generated, EXACT — default dark / default light)

Semantic names are Linear's (the `theme.color.*` map); values are generator
output. `*`Hover/`Thin`/`Alpha` variants exist for every background and border
token (e.g. `bgBaseHover` `#191a1b`, `bgBorderFaintAlpha` `#ffffff0b`); mine
them from the generator the same way when a component needs one.

| Token | Dark (default) | Light |
|---|---|---|
| `bgSub` (deepest surface) | `#09090a` | `#eeeeef` |
| `bgBase` (content background) | `#111212` | `#f8f8f9` |
| `bgShade` | `#151617` | `#e9e9ea` |
| `bgSelected` | `#1b1e37` | `#e7e8f3` |
| `bgFocus` | `#222223` | `#eaeaeb` |
| `bgBorder` | `#232325` | `#dedede` |
| `bgBorderFaint` | `#1a1b1d` | `#f1f1f1` |
| `bgBorderStrong` | `#727376` | `#7c7c7c` |
| `bgSelectedBorder` | `#2b2d4b` | `#cdcdd3` |
| `labelTitle` | `#ffffff` | `#1b1b1b` |
| `labelBase` (primary text) | `#e2e3e5` | `#2f2f31` |
| `labelMuted` | `#949597` | `#5b5c5e` |
| `labelFaint` | `#565658` | `#9c9c9e` |
| `labelLink` | `#6f7ffe` | `#3f60d9` |
| `controlPrimary` (buttons) | `#5e69d1` | `#6d78d5` |
| `controlPrimaryHover` | `#6974e1` | `#5e69c1` |
| `controlPrimaryLabel` | `#fefeff` | `#fefeff` |
| `controlSecondary` | `#1b1b1c` | `#fefeff` |
| `controlSecondaryHover` | `#242526` | `#f3f3f3` |
| `blueBase` / `blueText` | `#55ccff` / `#00ceff` | `#55ccff` / `#007eff` |
| `greenBase` / `greenText` | `#26a544` / `#3de261` | `#43bc58` / `#008e08` |
| `orangeBase` / `orangeText` | `#ff7235` / `#ff9958` | `#ff7235` / `#cf4608` |
| `redBase` / `redText` | `#f34e52` / `#ff8583` | `#f34e52` / `#e1243a` |
| `yellowBase` / `yellowText` | `#f0bf00` / `#edbf0a` | `#f0bf00` / `#947100` |
| `purpleBase` / `purpleText` | `#5e6ad2` / `#adbaff` | `#5e6ad2` / `#4d6cfa` |
| `tealBase` / `tealText` | `#00b8cb` / `#00e8ff` | (mine when needed) |
| `bgModalOverlay` | `#00000066` | — |

Sub-theme variants (functions on the theme; used by chrome surfaces):

| Variant | bgSub | bgBase | Notes |
|---|---|---|---|
| sidebar (dark) | `#000000` | `#09090a` | app rail; `sidebarLinkBg` `#1d1e1f`, active `#28292b` |
| elevated (dark) | — | `#19191b` | cards/popovers |
| menu (dark) | — | `#202022` | context menus |

Correction to the R3.4 revision (audit Finding 1): `#08090a` appears in the
compiled CSS only inside a fade-gradient mask, not as the app background;
`#5e6ad2` is `purpleBase` (brand accents), while primary CONTROLS use
`#5e69d1`; and the R3.4 link/success/error values (`#4ea7fc`/`#3fb950`/
`#f85149`) are not Linear's at all — they match GitHub's palette.

## Inputs, shadows, focus (generated, dark)

- `inputPadding` `6px 12px`; `inputBackground` `#111212`; `inputBorder`
  `1px solid #232325`; `inputBorderRadius` `8px`; `inputFontSize` `0.8125rem`.
- `focusShadow` `0 0 0 1px #5e69d1`; `focusColor` `#5e69d1`.
- `shadowBorder` `0 0 0 0.5px #232325`; `shadowLow`
  `0px 0.5px 1px 1px #0000004c`; `shadowMedium` `0 3px 8px #0000001f, 0 2px 5px
  #0000001f, 0 1px 1px #0000001f`; `shadowColor` `#07070726`.
- Scrollbars: `scrollbarBg` `#575759`, thin, transparent track.

## Layout

- Content max width: `80ch` (`LayoutConstants.stylex.CMWJ5GGG.js`); wide
  overview `max(min(100% - 128px, 120ch), 80ch)`; scroll padding 48/40/16 by
  surface; editor bottom padding 384.
- Sidebar width: UNVERIFIED (user-resizable preference; extract during the R8
  verification pass).
- Copy tone (SPECS/loops.md): terse, sentence case.
- Loops list copy (LoopsManagementPage.CVnaEF7c.js): page title `Manage loops`;
  empty states `No loops yet` and `No matching loops`.

## Method note

StyleX compiles to atomic classes with hashed custom properties, and the base
`:root` block ships them EMPTY — so mining the compiled CSS alone misses the
theme (that is how the earlier anchors drifted a point or two). The exact path
is the generator: run the corpus's own `generateTheme` with the built-in
parameters and record the output. That keeps us on the right side of the legal
line automatically: we extract facts (values, structure) and write original CSS.
