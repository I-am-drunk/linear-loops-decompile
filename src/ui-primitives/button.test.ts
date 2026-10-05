import { test } from "node:test";
import assert from "node:assert/strict";
import { button, escapeHtml } from "./button.ts";
import {
  BUTTON_SIZES,
  BUTTON_SIZE_ORDER,
  BUTTON_RADIUS,
} from "./button-metrics.ts";
import { PRIMITIVES_CSS } from "./style.css.ts";

test("defaults to normal/secondary — the common case needs no arguments", () => {
  const html = button({ label: "Save" });
  assert.match(html, /data-size="normal"/);
  assert.match(html, /data-variant="secondary"/);
  assert.match(html, /type="button"/);
});

test("renders an anchor when href is given, never a button", () => {
  const html = button({ label: "Docs", href: "/docs" });
  assert.match(html, /^<a /);
  assert.doesNotMatch(html, /type="button"/);
});

test("a disabled link gets aria-disabled, not the disabled attribute", () => {
  const html = button({ label: "x", href: "/y", disabled: true });
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /(^|\s)disabled(\s|>)/);
});

test("a real button does get the disabled attribute", () => {
  assert.match(button({ label: "x", disabled: true }), /\sdisabled>/);
});

test("label and href are escaped — a label is user data", () => {
  const html = button({ label: `<img src=x onerror=1>`, href: `/a"b` });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
  assert.match(html, /href="\/a&quot;b"/);
});

test("escapeHtml handles & first, so entities are not double-escaped wrong", () => {
  assert.equal(escapeHtml(`&<>"`), "&amp;&lt;&gt;&quot;");
});

test("an unknown size throws rather than rendering an unstyled control", () => {
  // @ts-expect-error deliberately off-contract: JS callers exist
  assert.throws(() => button({ label: "x", size: "huge" }), /unknown size/);
});

// --- the CSS must agree with the cited metrics ---------------------------
// These are the tests that make the facts load-bearing. Without them,
// ui-facts.json and style.css.ts can drift apart: the gate checks that every
// CSS value is DECLARED somewhere in the facts, not that the right value
// reached the right selector. That is the gap that let a `6px` gap through
// here, citing the INPUT padding.

test("every size's four metrics reach its own selector", () => {
  for (const size of BUTTON_SIZE_ORDER) {
    const m = BUTTON_SIZES[size];
    const rule = PRIMITIVES_CSS.split("\n").find((l) =>
      l.includes(`data-size="${size}"`),
    );
    assert.ok(rule, `no rule for ${size}`);
    assert.ok(rule.includes(`height: ${m.height}px`), `${size} height`);
    assert.ok(rule.includes(`min-width: ${m.minWidth}px`), `${size} min-width`);
    assert.ok(rule.includes(`font-size: ${m.fontSize}`), `${size} font-size`);
    assert.ok(
      rule.includes(`padding: 0 ${m.paddingInline}px`),
      `${size} padding`,
    );
  }
});

test("the pill radius is on .btn itself, not per size", () => {
  const base = PRIMITIVES_CSS.slice(0, PRIMITIVES_CSS.indexOf("[data-size"));
  assert.ok(
    base.includes(`border-radius: ${BUTTON_RADIUS}`),
    "the 9999px pill must be on the shared .btn rule",
  );
});
