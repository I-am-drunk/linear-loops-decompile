import assert from "node:assert/strict";
import { test } from "node:test";
import { settingsThemeVariables } from "./settings.ts";

// Recorded by executing ColorConverter.CVwFbLBP.js mixCss against synthetic
// LCH inputs, with Toggle.CZiT7Lh6.js f()'s dark/light ratios (2026-10-07).
test("toggle colors match the reference converter in both themes and formats", () => {
  const color = { bgBase: "lch(10% 2 272)", labelBase: "lch(90% 4 272)" };
  const cases = [
    [true, "RGB", "#6e6f74", "#84858a"],
    [false, "RGB", "#95979c", "#a5a7ac"],
    [true, "LCH", "lch(47.186% 2.525 271.998 / 1)", "lch(55.765% 2.804 271.999 / 1)"],
    [false, "LCH", "lch(62.674% 3.037 271.999 / 1)", "lch(68.544% 3.24 271.999 / 1)"],
  ] as const;
  for (const [isDark, format, off, hover] of cases) {
    assert.deepEqual(settingsThemeVariables({ color, isDark }, format), {
      "--s-toggle-track-off": off, "--s-toggle-track-hover": hover,
    });
  }
});
