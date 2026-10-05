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
