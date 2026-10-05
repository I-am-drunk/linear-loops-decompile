/**
 * Input metrics, read out of the corpus.
 *
 * READ THIS BEFORE REACHING FOR `theme.inputBorderRadius`: that field is 8px
 * and it is NOT what Linear's inputs render with. Two layers publish these
 * five keys and they disagree on exactly one:
 *
 *   ThemeHelper's generateTheme return value   -> inputBorderRadius: 8px
 *   ThemeProvider's var group (sx-18yeszy)     -> --sx-ykavoc: 5px
 *
 * The var group wins where a component consumes it, and Input does:
 * --sx-ykavoc -> .sx-1mecoeu{border-radius} -> Input's `inputBase` style
 * object. So inputs are 5px. The other four metrics agree across both layers.
 *
 * src/ui-theme is CORRECT to return 8px — its goldens are executed from the
 * corpus generator, so they record what generateTheme genuinely computes.
 * Do not change it; read the radius from here instead. See issue #354.
 */
export const INPUT_RADIUS = "5px";

/** padding, from --sx-18pfyxa; matches generateTheme's inputPadding. */
export const INPUT_PADDING = "6px 12px";

/** padding-block, from --sx-x8afrf. */
export const INPUT_PADDING_BLOCK = "6px";

/** padding-inline, from --sx-1uu732i. */
export const INPUT_PADDING_INLINE = "12px";

/** font-size, from --sx-11lpf43 (authored `.8125rem`). */
export const INPUT_FONT_SIZE = "0.8125rem";

/**
 * `appearance: none` — class sx-jyslct on `inputBase`. Strips the platform
 * control chrome, which is what makes the other metrics visible at all.
 */
export const INPUT_APPEARANCE = "none";

/**
 * `transition: border .15s` — class sx-1e1sxwh on `inputBase`. The focus
 * border animates; nothing else does.
 */
export const INPUT_TRANSITION = "border .15s";

/**
 * `font-feature-settings: "calt" 0` — class sx-14bywn9 on `inputBase`.
 * Contextual alternates OFF. Inter ligates sequences like `->` by default,
 * which is wrong in a field holding an identifier or a URL.
 */
export const INPUT_FONT_FEATURE_SETTINGS = `"calt" 0`;
