import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeGenerateTheme,
  themePresets,
} from "../ui-theme/generate-theme.ts";
import {
  kebab,
  varName,
  themeVars,
  themeCss,
  CORPUS_VARS,
} from "./theme-css.ts";

const dark = makeGenerateTheme(false)({
  ...themePresets.darkDefault,
  colorFormat: "RGB",
});

test("kebab splits camelCase at every boundary, including digits", () => {
  assert.equal(kebab("bgBase"), "bg-base");
  assert.equal(kebab("bgBorderFaintAlphaHover"), "bg-border-faint-alpha-hover");
  assert.equal(kebab("labelBase"), "label-base");
  assert.equal(kebab("plain"), "plain");
});

test("varName prefixes --t- so a token cannot collide with Linear's own", () => {
  assert.equal(varName("bgBase"), "--t-bg-base");
  assert.equal(varName("inputBorderRadius"), "--t-input-border-radius");
});

test("every token the shell stylesheet consumes is actually published", async () => {
  const { SHELL_CSS } = await import("./style.css.ts");
  const published = new Set(
    [...themeVars(dark), ...CORPUS_VARS].map(([name]) => name),
  );
  const consumed = [...SHELL_CSS.matchAll(/var\((--t-[a-z0-9-]+)\)/g)].map(
    (m) => m[1]!,
  );
  assert.ok(consumed.length > 0, "the stylesheet should consume theme tokens");
  for (const name of new Set(consumed)) {
    assert.ok(
      published.has(name),
      `${name} is used in style.css.ts but no theme key produces it`,
    );
  }
});

test("names are unique — two keys must not kebab to one variable", () => {
  const names = themeVars(dark).map(([name]) => name);
  assert.equal(names.length, new Set(names).size);
});

test("no key is published empty — an empty var silently defeats a fallback", () => {
  for (const [name, value] of themeVars(dark)) {
    assert.ok(value.trim().length > 0, `${name} is empty`);
  }
});
