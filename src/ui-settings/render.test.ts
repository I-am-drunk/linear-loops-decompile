/** ST1/ST2 rendering: escaping, the five patterns, nav state. No DOM. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { esc, renderNav, renderRow, renderSection, renderShell } from "./render.ts";
import type { Row } from "./rows.ts";

test(`esc neutralizes markup and both quote styles`, () => {
  assert.equal(esc(`<img src=x onerror="go()">`), `&lt;img src=x onerror=&quot;go()&quot;&gt;`);
  assert.equal(esc(`it's`), `it&#39;s`);
  // & first, or inserted entities get double-escaped
  assert.equal(esc(`a & <b>`), `a &amp; &lt;b&gt;`);
});

test(`a hostile workspace name cannot break out of an attribute`, () => {
  const row: Row = { kind: `text`, id: `name`, label: `Name`, value: `" onfocus="steal()` };
  const html = renderRow(row);
  assert.ok(!html.includes(`onfocus="steal()`), `raw handler survived: ${html}`);
  assert.ok(html.includes(`&quot; onfocus=&quot;steal()`));
});

test(`credential rows never emit the secret, and never a prefilled input`, () => {
  const html = renderRow({ kind: `credential`, id: `k`, label: `API key`, configured: true, hint: `…4f2a` });
  assert.ok(html.includes(`…4f2a`));
  assert.ok(html.includes(`Replace`));
  // No input element at all: a prefilled password field is a value going out.
  assert.ok(!/<input/.test(html), html);
});

test(`an unset credential offers Set and says Not set`, () => {
  const html = renderRow({ kind: `credential`, id: `k`, label: `API key`, configured: false });
  assert.ok(html.includes(`Not set`));
  assert.ok(html.includes(`data-act="set"`));
});

test(`toggle reports its state through aria-checked`, () => {
  assert.ok(renderRow({ kind: `toggle`, id: `t`, label: `On`, on: true }).includes(`aria-checked="true"`));
  assert.ok(renderRow({ kind: `toggle`, id: `t`, label: `On`, on: false }).includes(`aria-checked="false"`));
});

test(`select marks exactly one option selected`, () => {
  const html = renderRow({
    kind: `select`, id: `m`, label: `Model`, value: `b`,
    options: [{ value: `a`, label: `A` }, { value: `b`, label: `B` }],
  });
  assert.equal(html.match(/selected/g)?.length, 1);
  assert.ok(html.includes(`<option value="b" selected>B</option>`));
});

test(`connection rows pair the badge with the opposite action`, () => {
  const on = renderRow({ kind: `connection`, id: `c`, label: `Linear`, state: `connected` });
  assert.ok(on.includes(`Connected`) && on.includes(`data-act="disconnect"`));
  const off = renderRow({ kind: `connection`, id: `c`, label: `Linear`, state: `error`, detail: `401` });
  assert.ok(off.includes(`Error`) && off.includes(`data-act="connect"`) && off.includes(`401`));
});

test(`disabled rows dim and mark the control inert`, () => {
  const html = renderRow({ kind: `toggle`, id: `t`, label: `X`, on: false, disabled: true });
  assert.ok(html.includes(`s-off`) && html.includes(`disabled`));
});

test(`nav marks only the current item`, () => {
  const html = renderNav([{ id: `a`, title: `A` }, { id: `b`, title: `B` }], `b`);
  assert.equal(html.match(/aria-current="page"/g)?.length, 1);
  assert.ok(html.includes(`href="#/settings/b" aria-current="page"`));
});

test(`section and shell nest without losing rows`, () => {
  const page = {
    id: `inf`, title: `Inference`,
    sections: [{ id: `p`, title: `Providers`, blurb: `Where models come from`,
      rows: [{ kind: `toggle`, id: `t`, label: `Enable`, on: true }] as Row[] }],
  };
  const html = renderShell([{ id: `inf`, title: `Inference` }], `inf`, page);
  assert.ok(html.includes(`<h1 class="s-h1">Inference</h1>`));
  assert.ok(html.includes(`Where models come from`));
  assert.ok(html.includes(`aria-checked="true"`));
});

test(`no colour literal anywhere in the stylesheet`, async () => {
  const { SETTINGS_CSS } = await import("./style.css.ts");
  // docs/plan/settings.md: colours come from src/ui-theme tokens only.
  // Mechanical, because "no component hardcodes a color" needs enforcing.
  const literals = SETTINGS_CSS.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g);
  assert.equal(literals, null, `colour literals: ${literals?.join(`, `)}`);
  assert.ok(SETTINGS_CSS.includes(`var(--t-bgBase)`));
});

// --- accessible names (CodeRabbit inline review on #337) -----------------
// renderRow put the <label> in a SIBLING div from the control, with no
// `for` — so wrapping did not associate them either, and every control had
// no accessible name. This is the settings shell's row primitive, so ST3,
// ST4 and ST5 all inherit whatever it does.

test(`a natively-labelable control is addressed by the label's for`, () => {
  const rows: Row[] = [
    { kind: `text`, id: `r.a`, label: `Base URL`, value: `` },
    { kind: `select`, id: `r.b`, label: `Model`, value: `x`, options: [{ value: `x`, label: `X` }] },
  ];
  for (const row of rows) {
    const html = renderRow(row);
    assertReferencesResolve(html);
  }
});

test(`a button-based control carries the label as its accessible name`, () => {
  const html = renderRow({ kind: `toggle`, id: `r.c`, label: `Ask first`, on: false });
  assertReferencesResolve(html);
});

test(`an action button keeps its verb as the name and the label as description`, () => {
  // "Set" and "Connect" ARE the accessible name — the row label is context,
  // so describedby rather than labelledby. Replacing the name with "API key"
  // would lose the action.
  const cred = renderRow({ kind: `credential`, id: `r.d`, label: `API key`, configured: false });
  assertReferencesResolve(cred);
  assert.doesNotMatch(cred, /aria-labelledby/);

  const conn = renderRow({ kind: `connection`, id: `r.e`, label: `Anthropic`, state: `checking` });
  assertReferencesResolve(conn);
});

test(`ids are escaped — a row id reaches an attribute`, () => {
  const html = renderRow({ kind: `text`, id: `a"b`, label: `X`, value: `` });
  assert.doesNotMatch(html, /id="a"b/);
  assert.match(html, /&quot;/);
});

function assertReferencesResolve(html: string): void {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate element IDs");
  const refs = [...html.matchAll(/\s(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g)];
  assert.ok(refs.length > 0, "no control references");
  for (const match of refs) {
    for (const id of match[1]!.split(/\s+/)) assert.ok(ids.includes(id), `unresolved ID: ${id}`);
  }
}

test("labels resolve with whitespace IDs, repeated rows and distinct roots", () => {
  const row: Row = { kind: "toggle", id: "same id\t\ud800", label: "Enable", on: false };
  const page = { id: "p", title: "Page", sections: [
    { id: "a", title: "A", rows: [row] }, { id: "b", title: "B", rows: [row] },
  ] };
  assertReferencesResolve(renderShell([], "p", page, "one") + renderShell([], "p", page, "two"));
});
