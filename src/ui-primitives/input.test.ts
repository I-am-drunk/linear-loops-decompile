import { test } from "node:test";
import assert from "node:assert/strict";
import { input } from "./input.ts";
import { PRIMITIVES_CSS } from "./style.css.ts";
import {
  INPUT_RADIUS,
  INPUT_PADDING_BLOCK,
  INPUT_PADDING_INLINE,
  INPUT_FONT_SIZE,
} from "./input-metrics.ts";

test("defaults to type=text", () => {
  assert.match(input({ name: "q", label: "Query" }), /type="text"/);
});

test("a field with no label and no placeholder is refused", () => {
  assert.throws(() => input({ name: "q" }), /needs a label/);
});

test("a placeholder alone is accepted but does not become the label", () => {
  const html = input({ name: "q", placeholder: "Search" });
  assert.match(html, /placeholder="Search"/);
  assert.doesNotMatch(html, /aria-label/);
});

test("every attribute is escaped — name and value are user data", () => {
  const html = input({ name: `a"b`, label: `<x>`, value: `"&` });
  assert.match(html, /name="a&quot;b"/);
  assert.match(html, /aria-label="&lt;x&gt;"/);
  assert.match(html, /value="&quot;&amp;"/);
});

test("the four cited input metrics reach the .input rule", () => {
  const start = PRIMITIVES_CSS.indexOf(".input {");
  assert.ok(start !== -1, "no .input rule");
  const rule = PRIMITIVES_CSS.slice(start, PRIMITIVES_CSS.indexOf("}", start));
  assert.ok(rule.includes(`border-radius: ${INPUT_RADIUS}`), "radius");
  assert.ok(rule.includes(`padding-block: ${INPUT_PADDING_BLOCK}`), "p-block");
  assert.ok(rule.includes(`padding-inline: ${INPUT_PADDING_INLINE}`), "p-inline");
  assert.ok(rule.includes(`font-size: ${INPUT_FONT_SIZE}`), "font-size");
});

test("the input radius is 5px, NOT the generator's 8px default", () => {
  assert.equal(INPUT_RADIUS, "5px");
  const start = PRIMITIVES_CSS.indexOf(".input {");
  const rule = PRIMITIVES_CSS.slice(start, PRIMITIVES_CSS.indexOf("}", start));
  assert.doesNotMatch(
    rule,
    /border-radius:\s*8px/,
    "8px is theme.inputBorderRadius, which the StyleX var group overrides",
  );
});

test("no focus rule is invented — Input's chunk carries none", () => {
  assert.doesNotMatch(PRIMITIVES_CSS, /\.input:focus\s*\{/);
});
