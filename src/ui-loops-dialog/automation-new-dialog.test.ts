/**
 * Golden test (the G0 acceptance bar): our clean module's output, projected
 * through the SAME tagged-v2 grammar the corpus execution was recorded with
 * (tools/corpus-exec/serialize.ts — the DECLARED observation driver, #225
 * 23:41Z red-team), must byte-match the committed corpus-executed golden pair.
 *
 * The inputs fed in are each golden's own declared stub pins: the theme
 * shapes replicate golden/theme-stub{,-light}.mjs (H2 elevated derived-theme
 * identity pins; darkDefault = no baseTheme, lightDefault = elevatedTheme
 * ONLY on baseTheme), the component registry replicates the five seam string
 * markers, and the props replicate the case files' pin strings.
 */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serialize, SERIALIZER_VERSION } from "../../tools/corpus-exec/serialize.ts";
import { AutomationNewDialog, type DialogTheme } from "./automation-new-dialog.ts";

type Golden = { provenance: { serializer: string }; output: unknown };
function loadGolden(name: string): Golden {
  return JSON.parse(readFileSync(join(import.meta.dirname, `golden`, `automation-new-dialog.${name}.expected.json`), `utf8`)) as Golden;
}

// The case files' declared stubs, replicated as values (same pins, same shapes).
const components = {
  Modal: `stub:ContextualMenuActions.eL(Modal)`,
  ThemeProvider: `stub:ThemeProvider.t`,
  IconButton: `stub:IconButton.t`,
  CloseIcon: `stub:CloseIcon.t`,
  LoopTemplateLibrary: `stub:LoopTemplateLibrary.t`,
};
const props = { parent: `pin:parent`, onRequestClose: `pin:onRequestClose` };

// theme-stub.mjs: root has NO baseTheme — pins the `baseTheme ?? theme` fallback.
const darkTheme: DialogTheme = {
  baseTheme: undefined,
  elevatedTheme: () => ({
    themePin: `H2 golden-derived-retina0.json darkDefault.derived.elevated`,
    hash: `9cc5a10052803f8f8560263e4208bb1e7e59d237`,
    isDark: true,
    bgBase: `#19191b`,
  }),
};

// theme-stub-light.mjs: elevatedTheme lives ONLY on baseTheme — a module that
// wrongly derived from the root theme would throw, not silently pass.
const lightTheme: DialogTheme = {
  baseTheme: {
    elevatedTheme: () => ({
      themePin: `H2 golden-derived-retina0.json lightDefault.derived.elevated`,
      hash: `f5f7dd376d410d6c1212def26b3905d01a6cfabb`,
      isDark: false,
      bgBase: `#ffffff`,
    }),
  },
};

test(`golden serializer version matches the one this test projects with`, () => {
  assert.equal(loadGolden(`darkDefault`).provenance.serializer, SERIALIZER_VERSION);
  assert.equal(loadGolden(`lightDefault`).provenance.serializer, SERIALIZER_VERSION);
});

for (const [name, theme] of [[`darkDefault`, darkTheme], [`lightDefault`, lightTheme]] as const) {
  test(`clean module byte-matches the corpus-executed golden (${name})`, () => {
    const ours = serialize(AutomationNewDialog(theme, components, props));
    assert.equal(
      `${JSON.stringify(ours, null, 2)}\n`,
      `${JSON.stringify(loadGolden(name).output, null, 2)}\n`,
    );
  });
}

test(`the derived theme flows through: elevatedTheme() result lands verbatim in the ThemeProvider prop`, () => {
  const marker = { pin: `some-other-elevated-theme` };
  const out = AutomationNewDialog({ baseTheme: undefined, elevatedTheme: () => marker }, components, props) as unknown as {
    props: { children: { props: { theme: unknown } } };
  };
  assert.equal(out.props.children.props.theme, marker);
});

test(`baseTheme wins over the root theme when present (the lightDefault branch)`, () => {
  const fromBase = { pin: `from-base` };
  const theme: DialogTheme = {
    baseTheme: { elevatedTheme: () => fromBase },
    // A root elevatedTheme that must NOT be used when baseTheme exists:
    elevatedTheme: () => {
      throw new Error(`root elevatedTheme must not be called when baseTheme is present`);
    },
  };
  const out = AutomationNewDialog(theme, components, props) as unknown as {
    props: { children: { props: { theme: unknown } } };
  };
  assert.equal(out.props.children.props.theme, fromBase);
});
