/**
 * Theme colors -> CSS custom properties.
 *
 * `src/ui-theme` reproduces Linear's generateTheme, so its color map and its
 * input-metric strings are exact by construction (golden-backed, see
 * src/ui-theme/golden). This file only RENAMES those keys into CSS variables;
 * it invents no value, which is why it needs no ui-facts citation of its own.
 *
 * Naming: a camelCase theme key becomes `--t-<kebab-case>`.
 *   bgBase        -> --t-bg-base
 *   bgBorderFaint -> --t-bg-border-faint
 *   labelBase     -> --t-label-base
 */
import type { Theme } from "../ui-theme/generate-theme.ts";

/** `bgBorderFaint` -> `bg-border-faint`. */
export function kebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** The CSS variable name a theme key is published under. */
export function varName(key: string): string {
  return `--t-${kebab(key)}`;
}

/**
 * Metrics the generator derives rather than we choose. These are Theme fields,
 * not color-map entries, and they are strings already carrying units.
 */
const METRIC_KEYS = [
  "inputPadding",
  "inputPaddingBlock",
  "inputPaddingInline",
  "inputBorderRadius",
  "inputFontSize",
  "inputBackground",
  "inputBorder",
  "focusShadow",
  "shadowLow",
  "shadowMedium",
  "shadowHigh",
  "shadowInset",
  "shadowBorder",
  // NOT shadowColor: it is already a key in theme.color, and publishing it
  // twice produced one --t-shadow-color from two sources. Caught by the
  // uniqueness test, which exists for exactly this.
] as const;

/**
 * Every published variable, as [name, value] pairs, in a stable order:
 * the color map first (sorted, so output is deterministic across engines),
 * then the generator's own metrics.
 */
export function themeVars(theme: Theme): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const key of Object.keys(theme.color).sort()) {
    out.push([varName(key), theme.color[key]!]);
  }
  for (const key of METRIC_KEYS) {
    const value = theme[key];
    if (typeof value === "string" && value.length > 0) {
      out.push([varName(key), value]);
    }
  }
  return out;
}

/** The `:root{...}` block that publishes a theme and the corpus-read vars. */
export function themeCss(theme: Theme, selector = ":root"): string {
  const body = [...themeVars(theme), ...CORPUS_VARS]
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
  return `${selector} {\n${body}\n}\n`;
}

/**
 * Values read from the corpus rather than derived by the generator. They are
 * published as `--t-*` alongside the theme so the stylesheet has one source of
 * variables, but their provenance is different: each appears in
 * ui-facts.json with the citation it was read from.
 *
 * --t-font-regular: the `--font-regular` custom property in the compiled
 * stylesheet. A font stack's canonical home IS a custom property, so citing it
 * there supports the claim (see the leg-5 narrowing in tools/ui-facts).
 */
export const CORPUS_VARS: Array<[string, string]> = [
  [
    "--t-font-regular",
    '"Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, ' +
      '"Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", ' +
      '"Helvetica Neue", "Linear Thai", sans-serif',
  ],
  [
    // --font-monospace in the compiled stylesheet. Needed by the node tier's
    // code blocks (SH3); same provenance as the regular stack above.
    "--t-font-monospace",
    '"Berkeley Mono", "SFMono Regular", Consolas, "Liberation Mono", Menlo, ' +
      "Courier, monospace",
  ],
];
