/**
 * The exactness bar for generateTheme (issue #168): every value our
 * reimplementation produces must equal, byte-for-byte, what the corpus
 * generator computes. The golden/*.json fixtures were produced by executing
 * the CORPUS chunks offline in Node (ThemeHelper + lightThemeRefresh +
 * ColorConverter + object_hash + rolldown-runtime, with the single
 * ThemeProvider retina boolean pinned per file — recipe on issue #168 /
 * #162), so these tests compare our code against Linear's own computation,
 * not against hand-written expectations.
 *
 * Covered: all four first-party parametrizations x both retina branches x
 * all 116 color tokens + 18 shell values + the input hash; the six derived
 * themes (elevated/sub/menu/selected/focus/sidebar) per parametrization;
 * the dynamic functions (highlightVariant, textHighlight); LCH and P3
 * output formats.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { makeGenerateTheme, themePresets, type Theme, type ThemeInput } from "./generate-theme.ts";

function golden(name: string): Record<string, Record<string, unknown>> {
  return JSON.parse(readFileSync(new URL(`./golden/${name}.json`, import.meta.url), `utf8`));
}

// fixture key -> preset key
const CASES: [string, keyof typeof themePresets][] = [
  [`darkDefault`, `darkDefault`],
  [`darkHC`, `darkHighContrast`],
  [`lightDefault`, `lightDefault`],
  [`lightHC`, `lightHighContrast`],
];

function makeRoot(retina: boolean, preset: keyof typeof themePresets, colorFormat: ThemeInput[`colorFormat`] = `RGB`): Theme {
  const generate = makeGenerateTheme(retina);
  return generate({ ...themePresets[preset], colorFormat });
}

/** Every scalar (string/number/boolean) field plus the full color map. */
function assertShellAndColors(ours: Theme, want: Record<string, unknown>, label: string): void {
  for (const [key, value] of Object.entries(want)) {
    if (key === `color`) {
      assert.deepEqual(ours.color, value, `${label}: color map`);
    } else if (typeof value !== `object`) {
      assert.equal((ours as unknown as Record<string, unknown>)[key], value, `${label}: ${key}`);
    }
  }
}

for (const retina of [false, true]) {
  const fixtures = golden(retina ? `golden-derived-retina1` : `golden-derived-retina0`);
  const sidebarFixtures = golden(retina ? `golden-sidebar-retina1` : `golden-sidebar-retina0`);
  for (const [fixtureKey, presetKey] of CASES) {
    test(`${presetKey} (retina=${retina}) matches the corpus byte-for-byte, derived themes included`, () => {
      const want = fixtures[fixtureKey];
      const root = makeRoot(retina, presetKey);
      assertShellAndColors(root, want, fixtureKey);

      const derived = want.derived as Record<string, Record<string, unknown>>;
      assertShellAndColors(root.elevatedTheme(), derived.elevated, `${fixtureKey}.elevated`);
      assertShellAndColors(root.subTheme(), derived.sub, `${fixtureKey}.sub`);
      assertShellAndColors(root.menuTheme(), derived.menu, `${fixtureKey}.menu`);
      assertShellAndColors(root.selectedTheme(), derived.selected, `${fixtureKey}.selected`);
      assertShellAndColors(root.focusTheme(), derived.focus, `${fixtureKey}.focus`);
      // sidebarTheme mutates the shared subTheme memo in place (real
      // upstream behavior) — its fixture was captured on a FRESH root with
      // no prior subTheme call, so mirror that here.
      const sidebarRoot = makeRoot(retina, presetKey);
      assertShellAndColors(sidebarRoot.sidebarTheme(), sidebarFixtures[fixtureKey], `${fixtureKey}.sidebar`);
    });
  }
}

test(`dynamic functions match the corpus (highlightVariant, textHighlight)`, () => {
  const fixtures = golden(`golden-functions-retina0`);
  for (const [fixtureKey, presetKey] of CASES) {
    const root = makeRoot(false, presetKey);
    const want = fixtures[fixtureKey] as {
      highlightVariant: Record<string, string>;
      textHighlight: Record<string, string>;
    };
    for (const [input, expected] of Object.entries(want.highlightVariant)) {
      assert.equal(root.highlightVariant(input), expected, `${fixtureKey}: highlightVariant(${input})`);
    }
    for (const [input, expected] of Object.entries(want.textHighlight)) {
      assert.equal(root.textHighlight(input, 0.15), expected, `${fixtureKey}: textHighlight(${input}, 0.15)`);
    }
  }
});

test(`LCH and P3 color formats match the corpus`, () => {
  const fixtures = golden(`golden-formats-retina0`) as unknown as Record<string, Record<string, Record<string, string>>>;
  for (const format of [`LCH`, `P3`] as const) {
    for (const [fixtureKey, presetKey] of CASES) {
      const root = makeRoot(false, presetKey, format);
      assert.deepEqual(root.color, fixtures[format][fixtureKey], `${format} ${fixtureKey}: color map`);
    }
  }
});

test(`memoization: the same input returns the same Theme instance`, () => {
  const generate = makeGenerateTheme(false);
  const a = generate({ ...themePresets.darkDefault, colorFormat: `RGB` });
  const b = generate({ ...themePresets.darkDefault, colorFormat: `RGB` });
  assert.equal(a, b);
  // derived themes memoize per root theme too
  assert.equal(a.elevatedTheme(), b.elevatedTheme());
});

test(`the input hash is the corpus object-hash (regression pin)`, () => {
  // Corpus-computed value, quoted on issue #162 (sess_01a0e393-0683) and
  // reproduced from the corpus generator today: dark-default RGB input.
  const root = makeRoot(false, `darkDefault`);
  assert.equal(root.hash, `f4ac7a583d9525072ff197abaefc16701f7817d1`);
});

test(`token inventory: 116 color tokens per theme`, () => {
  const root = makeRoot(false, `darkDefault`);
  assert.equal(Object.keys(root.color).length, 116);
});
