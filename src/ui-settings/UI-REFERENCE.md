# Settings reference and coverage

This is a partial implementation of Linear's default settings primitives.
It has not passed an authenticated same-state screenshot comparison. Exact corpus
identities are in [ui-facts.json](ui-facts.json); hashes identify the reference
snapshot without assuming an application release number.

The old citations pointed at a virtualized SettingsList table, unrelated popover
padding, and a tab width. The direct component chain below replaces them.
SPACE and RADIUS remain compatibility exports; settings CSS uses scoped facts.
The exports are not blanket evidence for another component.

| Our element | Verified reference chain |
|---|---|
| Page/header/stack | AccountPreferencesSettingsPage imports XP/ZP from ContextualMenuActions: nM/iM, styles aM. |
| Section/card/row | UP/MP/bP/yP resolve to dM/gM/zM/LM; gM uses SM → bQe and mM.box; rows use DM → bM and mM.listItem. |
| Label/description | zM/LM use Text smallPlus/mini; BM uses UM.settingsListItemTitle. Text variants resolve through mixins.stylex. |
| Navigation | MainSettingsLayout W uses g2 with G.link/G.text overrides. v2.linkBase and v2.textBase both declare radius 8px. |
| Toggle | zM uses Toggle f, normal h.normal, p.toggleBase, and m state insets. |
| Text input | Input u uses S.inputBase; ThemeProvider var-group overrides radius to 5px. |
| Native select | Our choice uses Input f metrics, not LM's custom Select via HQe/Wg. |
| Text action button | Settings VM uses Button; desktop normal uses v.base, x.normal, D.normal, secondary colors. |

The distinction between a card and its row matters: mM.box overrides row padding
to 16px and radius to 10px. Root defaults or matching numbers in other components
cannot establish these settings values.

## Host bindings

Provide camel-case theme variables: each `theme.color[name]` becomes
`--t-${name}`, and `theme.shadowLow` becomes `--t-shadowLow`. These names are
not SH1's kebab-case bindings. Bind the appropriate generated theme at each
surface: reference SM uses a subtheme wrapper unless a baseTheme already exists.
Font-family is specified; font installation/loading remains the host's job.

Bind `--s-toggle-track-off` and `--s-toggle-track-hover` with the original
`settingsThemeVariables` helper in the theme package. The reference
Toggle calls ColorConverter.mixCss with bgBase/labelBase and theme-dependent
ratios. That function uses the color converter's mixing space, not CSS color-mix.
Only resting off/on colors are consumed here; hover expansion/timing is omitted.

`--s-sidebar-width` can override the 244px saved-preference default. This only
models an untouched desktop preference with no larger platform minimum. Reference
Ttn also applies a platform minimum, a small-mode branch, and resizing; those
behaviors are not implemented. The old fixed 220px tab-width citation is removed.

At viewport widths up to 640px, the cited page margins, header spacer, section
gap, paragraph line height and row horizontal spacing use their narrow overrides.
Navigation gains the cited top padding when scroll timelines are supported.
These adjustments do not implement the reference's complete mobile shell.

## Remaining gaps

| Surface | Current limit |
|---|---|
| Product copy | Provider/integration names, hints, actions, connection labels, and descriptions are our product choices, not verified Linear copy. |
| Select | Native platform interaction/appearance remains. Custom Select menu, caret, and keyboard parity are unimplemented. |
| Toggle | Our button with switch semantics draws verified resting dimensions. The reference uses a checkbox; hover expansion, timing, and extended hit area are omitted. |
| Connection | Supporting text reuses Text mini. No matching pill badge was verified; badge padding, backgrounds, and radii are removed. |
| Alternate layouts | Touch dimensions, mobile shell, full sidebar resizing, and scroll-timeline effects beyond top padding remain unimplemented. A fixed desktop sidebar can overflow narrow viewports. |
| Theme/focus | Host must provide the matching surface theme. Button overlay effects and input hover-border interpolation are omitted. |

Before claiming visual parity, capture the authenticated reference with the same
state, viewport, scale, theme, and font availability; compare rendered geometry
and interactions. Declaration checks verify coverage and scope, not visual truth.
