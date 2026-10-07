import { fromCss, mix, toCss, type ColorFormat } from "./color.ts";
import type { Theme } from "./generate-theme.ts";

/**
 * Apply these beside the host's --t-* variables. Select outputFormat using
 * the browser's supported color format, as for the main theme.
 * Source: Toggle.CZiT7Lh6.js f() and ColorConverter.CVwFbLBP.js mixCss.
 */
export function settingsThemeVariables(
  theme: Pick<Theme, "color" | "isDark">,
  outputFormat: ColorFormat,
): Record<string, string> {
  const background = theme.color.bgBase;
  const label = theme.color.labelBase;
  if (background === undefined || label === undefined) {
    throw new TypeError("Settings theme requires bgBase and labelBase");
  }
  const a = fromCss(background), b = fromCss(label);
  return {
    "--s-toggle-track-off": toCss(outputFormat, mix(a, b, theme.isDark ? 0.2 : 0.4)),
    "--s-toggle-track-hover": toCss(outputFormat, mix(a, b, theme.isDark ? 0.3 : 0.5)),
  };
}
