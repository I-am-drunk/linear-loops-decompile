# ui-theme — Linear's generateTheme, exactly (issue #168)

Linear's theme is a runtime FUNCTION, not a palette: `generateTheme({base,
accent, colorFormat, contrast})` computes 116 color tokens + 18 shell values
per theme, plus derived elevated/sub/menu/selected/focus/sidebar themes.
This package reproduces that function precisely — same math, same branches,
same clamps — in our own zero-dependency, strip-only-safe TypeScript.

- `color.ts` — LCh color math (D50 Lab, sRGB/P3 matrices, APCA contrast,
  mix/adjust/toCss), reproduced from corpus `ColorConverter.CVwFbLBP.js`.
- `hash.ts` — the theme-input object-hash (sha1, sorted keys, ordered
  arrays), reproduced from the bundled `object-hash` options ThemeHelper uses.
- `generate-theme.ts` — the generator + the four first-party parametrizations
  (corpus `ThemeHelper.CeMKYPhf.js` + `lightThemeRefresh.DyWCsE3P.js`).
- `golden/` — golden vectors EXECUTED from the corpus generator offline
  (recipe on issue #168; retina pinned per file). The tests assert
  byte-for-byte equality against them: the corpus computes the expectation,
  we never hand-write it.

Regenerate goldens after a corpus refresh: run the corpus chunks in Node with
the ThemeProvider retina stub (issue #168 comment has the exact recipe), then
re-run `node --experimental-strip-types --test generate-theme.test.ts`.

Legal: original code; the golden values are computed facts (token names and
color values), same category as `extracts/`. No Linear code is committed.
