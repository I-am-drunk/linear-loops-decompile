/**
 * Theme -> CSS custom properties.
 *
 * `src/ui-theme` generates the 116-token color set plus the shell tokens. The
 * shell consumes them only as CSS variables: no component hardcodes a color,
 * and switching preset is one `:root` rewrite. Variable names are the token
 * names, kebab-cased, under a `--t-` prefix.
 */
import { makeGenerateTheme, themePresets, type Theme, type ThemeInput } from "../ui-theme/generate-theme.ts";
import type { ColorFormat } from "../ui-theme/color.ts";


export type PresetName = keyof typeof themePresets;

const generate = makeGenerateTheme(false);

/**
 * The presets carry base/accent/contrast only; `colorFormat` is the caller's
 * choice. RGB because the shell emits plain CSS variables that every target
 * browser reads without a gamut negotiation.
 */
const COLOR_FORMAT: ColorFormat = "RGB";

export function presetInput(preset: PresetName): ThemeInput {
  return { ...themePresets[preset], colorFormat: COLOR_FORMAT };
}

/** `bgBorderFaintHover` -> `--t-bg-border-faint-hover` */
export function cssVarName(token: string): string {
  return `--t-${token.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

/** The non-color shell tokens worth exposing; the rest are component-local. */
const SHELL_TOKENS = [
  "shadowColor",
  "focusShadow",
  "shadowLow",
  "shadowBorder",
  "shadowMedium",
  "shadowHigh",
  "shadowInset",
  "inputPadding",
  "inputPaddingBlock",
  "inputPaddingInline",
  "inputBackground",
  "inputBorder",
  "inputBorderRadius",
  "inputFontSize",
] as const satisfies readonly (keyof Theme)[];

/** Every `--t-*` declaration for a theme, sorted for stable output. */
export function themeDeclarations(theme: Theme): string[] {
  const out: string[] = [];
  for (const [token, value] of Object.entries(theme.color)) {
    out.push(`${cssVarName(token)}: ${value};`);
  }
  for (const token of SHELL_TOKENS) {
    const value = theme[token];
    if (typeof value === "string") out.push(`${cssVarName(token)}: ${value};`);
  }
  return out.sort();
}

/** A `:root` block for one preset, plus the colour-scheme hint. */
export function themeCss(input: ThemeInput = presetInput("darkDefault")): string {
  const theme = generate(input);
  const body = themeDeclarations(theme)
    .map((d) => `  ${d}`)
    .join("\n");
  return `:root {\n  color-scheme: ${theme.isDark ? "dark" : "light"};\n${body}\n}\n`;
}

export function themeFor(preset: PresetName): Theme {
  return generate(presetInput(preset));
}

export { themePresets };
