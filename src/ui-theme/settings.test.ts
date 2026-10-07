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

test("P3 source colors preserve the pinned converter's channel scale", () => {
  const color = {
    bgBase: "color(display-p3 0.1 0.3 0.5)",
    labelBase: "color(display-p3 0.8 0.7 0.2)",
  };
  const cases = [
    [true, "lch(0.096% 0.059 224.634 / 1)", "lch(0.108% 0.04 192.127 / 1)"],
    [false, "lch(0.119% 0.044 146.618 / 1)", "lch(0.131% 0.067 121.135 / 1)"],
  ] as const;
  for (const [isDark, off, hover] of cases) {
    assert.deepEqual(settingsThemeVariables({ color, isDark }, "LCH"), {
      "--s-toggle-track-off": off, "--s-toggle-track-hover": hover,
    });
  }
});
