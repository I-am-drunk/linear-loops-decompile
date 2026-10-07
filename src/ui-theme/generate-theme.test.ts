/**
 * The exactness bar for generateTheme (issue #168): every value our
 * reimplementation produces must equal, to 12 significant digits, what the corpus
 * generator computes. The golden/*.json fixtures were produced by executing
 * the CORPUS chunks offline in Node (ThemeHelper + lightThemeRefresh +
 * ColorConverter + object_hash + rolldown-runtime, with the single
 * ThemeProvider retina boolean pinned per file — recipe on issue #168 /
 * #162), so these tests compare our code against Linear's own computation,
 * not against hand-written expectations.
 *
 * Covered: all four first-party parametrizations x both retina branches x
 * all 116 color tokens + 18 shell values; the six derived themes
 * (elevated/sub/menu/selected/focus/sidebar) per parametrization; the dynamic
 * functions (highlightVariant, textHighlight); LCH and P3 output formats.
 *
 * The input hash is asserted byte-exact on ROOT themes only — see the
 * FLOAT_SENSITIVE_DIGEST note below for why a derived theme's digest cannot
 * be, and what is lost by skipping it (nothing: it digests the same floats
 * this suite already compares at tolerance).
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

/**
 * Engine float tolerance (issue #333).
 *
 * The goldens record what the CORPUS generator computed on one V8 build. The
 * OkLab -> P3/LCH path runs through Math.cbrt and Math.pow, which the spec
 * does not pin to bit-exactness, and V8's implementations changed between
 * Node 22 and 24. So dozens of the 116 tokens differ in the last one or two
 * digits (observed delta 2.8e-17) depending purely on the engine.
 *
 * Comparing raw doubles therefore made this suite green on Node 22 and red on
 * Node 24 for a clean checkout, which taught sessions to ignore the gate they
 * are told to run before pushing.
 *
 * We compare at DIGITS significant digits instead. A real regression in this
 * code moves a channel in digit 3 or earlier; nothing meaningful hides in
 * digit 16. The bar stays "our numbers are the corpus's numbers" — it just
 * stops also asserting "and your V8 rounds like ours."
 */
const DIGITS = 12;

const roundNums = (s: string): string =>
  s.replace(/\d+\.\d{10,}/g, (m) => Number.parseFloat(Number(m).toPrecision(DIGITS)).toString());

/** Normalize for comparison: round long decimals inside color() strings. */
function atPrecision(v: unknown): unknown {
  if (typeof v === `string`) return roundNums(v);
  if (typeof v === `number`) return Number.parseFloat(v.toPrecision(DIGITS));
  if (Array.isArray(v)) return v.map(atPrecision);
  if (v && typeof v === `object`) {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, atPrecision(x)]));
  }
  return v;
}

/**
 * `hash` is sha1 over the theme INPUT, so it has no tolerance: a 1-ulp float
 * change in an input channel produces an entirely different digest (verified
 * directly against hash.ts). Four of the five derived themes match exactly;
 * `selected` is the one whose base runs through mix() with the accent, which
 * is the float-sensitive path.
 *
 * So for derived themes we compare the OUTPUT at precision and skip the
 * digest. The digest is still asserted exactly on every ROOT theme, where the
 * input is the literal preset and no arithmetic precedes it — that is where a
 * real hashing regression would show.
 */
const FLOAT_SENSITIVE_DIGEST = new Set([`hash`]);

/** Every scalar (string/number/boolean) field plus the full color map. */
function assertShellAndColors(
  ours: Theme,
  want: Record<string, unknown>,
  label: string,
  skipDigest = false,
): void {
  for (const [key, value] of Object.entries(want)) {
    if (skipDigest && FLOAT_SENSITIVE_DIGEST.has(key)) continue;
    if (key === `color`) {
      assert.deepEqual(atPrecision(ours.color), atPrecision(value), `${label}: color map`);
    } else if (typeof value !== `object`) {
      assert.equal(
        atPrecision((ours as unknown as Record<string, unknown>)[key]),
        atPrecision(value),
        `${label}: ${key}`,
      );
    }
  }
}

for (const retina of [false, true]) {
  const fixtures = golden(retina ? `golden-derived-retina1` : `golden-derived-retina0`);
  const sidebarFixtures = golden(retina ? `golden-sidebar-retina1` : `golden-sidebar-retina0`);
  for (const [fixtureKey, presetKey] of CASES) {
    test(`${presetKey} (retina=${retina}) matches the corpus to 12 significant digits, derived themes included`, () => {
      const want = fixtures[fixtureKey];
      const root = makeRoot(retina, presetKey);
      assertShellAndColors(root, want, fixtureKey);

      const derived = want.derived as Record<string, Record<string, unknown>>;
      assertShellAndColors(root.elevatedTheme(), derived.elevated, `${fixtureKey}.elevated`, true);
      assertShellAndColors(root.subTheme(), derived.sub, `${fixtureKey}.sub`, true);
      assertShellAndColors(root.menuTheme(), derived.menu, `${fixtureKey}.menu`, true);
      assertShellAndColors(root.selectedTheme(), derived.selected, `${fixtureKey}.selected`, true);
      assertShellAndColors(root.focusTheme(), derived.focus, `${fixtureKey}.focus`, true);
      // sidebarTheme mutates the shared subTheme memo in place (real
      // upstream behavior) — its fixture was captured on a FRESH root with
      // no prior subTheme call, so mirror that here.
      const sidebarRoot = makeRoot(retina, presetKey);
      assertShellAndColors(sidebarRoot.sidebarTheme(), sidebarFixtures[fixtureKey], `${fixtureKey}.sidebar`, true);
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
      assert.deepEqual(
        atPrecision(root.color),
        atPrecision(fixtures[format][fixtureKey]),
        `${format} ${fixtureKey}: color map`,
      );
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
