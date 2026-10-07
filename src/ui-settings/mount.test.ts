/** ST1 mount: event delegation, translation, and re-render. Tiny fake DOM. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mountSettings, type AttrNode, type Elementish, type EventLike, type SettingsEvent } from "./mount.ts";
import type { Page } from "./rows.ts";

const PAGE: Page = {
  id: `inf`, title: `Inference`,
  sections: [{ id: `p`, title: `Providers`, rows: [{ kind: `toggle`, id: `t1`, label: `Enable`, on: false }] }],
};

function node(attrs: Record<string, string>, tagName?: string, value?: string): AttrNode {
  const own: Record<string, string> = { ...attrs };
  const self: AttrNode = {
    getAttribute: (n) => own[n] ?? null,
    setAttribute: (n, v) => { own[n] = v; },
    closest: () => null,
    ...(tagName === undefined ? {} : { tagName }),
    ...(value === undefined ? {} : { value }),
  };
  return self;
}

function host(): Elementish & { fire(type: string, target: AttrNode | null, over?: Partial<EventLike>): void; html(): string } {
  const handlers: Record<string, ((e: EventLike) => void)[]> = {};
  let inner = ``;
  return {
    get innerHTML() { return inner; },
    set innerHTML(v: string) { inner = v; },
    addEventListener(type, handler) { (handlers[type] ??= []).push(handler); },
    removeEventListener(type, handler) {
      handlers[type] = (handlers[type] ?? []).filter((h) => h !== handler);
    },
    querySelector: () => null,
    fire(type, target, over) { for (const h of handlers[type] ?? []) h({ type, target, ...over }); },
    html() { return inner; },
  };
}

const ITEMS = [{ id: `inf`, title: `Inference` }, { id: `igs`, title: `Integrations` }];

test(`mounting paints immediately`, () => {
  const h = host();
  mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE });
  assert.ok(h.html().includes(`Inference`));
  assert.ok(h.html().includes(`aria-checked="false"`));
});

test(`a toggle click reports the state being REQUESTED, not the current one`, () => {
  const h = host();
  const seen: SettingsEvent[] = [];
  mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE, onEvent: (e) => seen.push(e) });
  h.fire(`click`, node({ "data-row": `t1`, "aria-checked": `false` }));
  // Reporting `false` would make the host a no-op; the user asked for on.
  assert.deepEqual(seen, [{ kind: `toggle`, row: `t1`, on: true }]);
});

test(`a toggle is not double-reported on click AND change`, () => {
  const h = host();
  const seen: SettingsEvent[] = [];
  mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE, onEvent: (e) => seen.push(e) });
  const toggle = node({ "data-row": `t1`, "aria-checked": `false` });
  h.fire(`click`, toggle);
  h.fire(`change`, toggle);
  assert.equal(seen.length, 1, `double-reported: ${JSON.stringify(seen)}`);
});

test(`select and text changes carry their value`, () => {
  const h = host();
  const seen: SettingsEvent[] = [];
  mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE, onEvent: (e) => seen.push(e) });
  h.fire(`change`, node({ "data-row": `m` }, `SELECT`, `gpt`));
  h.fire(`change`, node({ "data-row": `n` }, `INPUT`, `acme`));
  assert.deepEqual(seen, [
    { kind: `select`, row: `m`, value: `gpt` },
    { kind: `text`, row: `n`, value: `acme` },
  ]);
});

test(`buttons report their action verb`, () => {
  const h = host();
  const seen: SettingsEvent[] = [];
  mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE, onEvent: (e) => seen.push(e) });
  h.fire(`click`, node({ "data-row": `k`, "data-act": `replace` }));
  assert.deepEqual(seen, [{ kind: `action`, row: `k`, act: `replace` }]);
});

test(`clicks outside a row are ignored`, () => {
  const h = host();
  const seen: SettingsEvent[] = [];
  mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE, onEvent: (e) => seen.push(e) });
  h.fire(`click`, node({ class: `s-page` }));
  h.fire(`click`, null);
  assert.deepEqual(seen, []);
});

test(`update() repaints with the new nav selection and page`, () => {
  const h = host();
  const m = mountSettings(h, { items: ITEMS, current: `inf`, page: PAGE });
  m.update({ current: `igs`, page: { id: `igs`, title: `Integrations`, sections: [] } });
  assert.ok(h.html().includes(`href="#/settings/igs" aria-current="page"`));
  assert.ok(h.html().includes(`<h1 class="s-h1">Integrations</h1>`));
  assert.ok(!h.html().includes(`aria-checked`));
});

test("navigation requests let the host select and render a page", () => {
  const h = host();
  let prevented = false;
  const seen: SettingsEvent[] = [];
  const m = mountSettings(h, { items: ITEMS, current: "inf", page: PAGE, onEvent(e) {
    seen.push(e);
    if (e.kind === "navigate") m.update({ current: e.page,
      page: { id: e.page, title: "Integrations", sections: [] } });
  } });
  h.fire("click", node({ "data-page": "igs" }), { preventDefault() { prevented = true; } });
  assert.deepEqual(seen, [{ kind: "navigate", page: "igs" }]);
  assert.ok(prevented);
  assert.match(h.html(), /href="#\/settings\/igs" aria-current="page"/);
  assert.match(h.html(), /<h1 class="s-h1">Integrations<\/h1>/);
});

test("modified or already-handled navigation preserves native behavior", () => {
  const h = host();
  const seen: SettingsEvent[] = [];
  mountSettings(h, { items: ITEMS, current: "inf", page: PAGE, onEvent: (e) => seen.push(e) });
  for (const over of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true },
    { altKey: true }, { button: 1 }, { defaultPrevented: true }]) {
    h.fire("click", node({ "data-page": "igs" }), { ...over,
      preventDefault() { assert.fail("native navigation cancelled"); } });
  }
  assert.deepEqual(seen, []);
  mountSettings(h, { items: ITEMS, current: "inf", page: PAGE });
  h.fire("click", node({ "data-page": "igs" }), {
    preventDefault() { assert.fail("navigation without a host cancelled"); },
  });
});

test("replacing and disposing a mount releases its handlers and updates", () => {
  const h = host();
  const seen: string[] = [];
  const first = mountSettings(h, { items: ITEMS, current: "inf", page: PAGE,
    onEvent: () => seen.push("first") });
  const second = mountSettings(h, { items: ITEMS, current: "inf", page: PAGE,
    onEvent: () => seen.push("second") });
  const rendered = h.html();
  first.update({ page: { id: "old", title: "Old", sections: [] } });
  first.dispose();
  h.fire("click", node({ "data-row": "t1", "aria-checked": "false" }));
  assert.deepEqual(seen, ["second"]);
  assert.equal(h.html(), rendered);
  second.dispose();
  second.dispose();
  second.update({ page: { id: "old", title: "Old", sections: [] } });
  h.fire("click", node({ "data-row": "t1", "aria-checked": "false" }));
  assert.deepEqual(seen, ["second"]);
  assert.equal(h.html(), rendered);
});

test("failed initial rendering does not retain callbacks", () => {
  const h = host();
  const seen: string[] = [];
  assert.throws(() => mountSettings(h, {
    items: [{ id: String.fromCharCode(55296), title: "Invalid" }],
    current: "inf", page: PAGE, onEvent: () => seen.push("failed"),
  }), URIError);
  const mounted = mountSettings(h, { items: ITEMS, current: "inf", page: PAGE,
    onEvent: () => seen.push("active") });
  const toggle = node({ "data-row": "t1", "aria-checked": "false" });
  h.fire("click", toggle);
  assert.deepEqual(seen, ["active"]);
  mounted.dispose();
  h.fire("click", toggle);
  assert.deepEqual(seen, ["active"]);
});

test("failed replacement preserves the previous page and mount", () => {
  const h = host();
  const seen: string[] = [];
  const mounted = mountSettings(h, { items: ITEMS, current: "inf", page: PAGE,
    onEvent: () => seen.push("previous") });
  const before = h.html();
  assert.throws(() => mountSettings(h, {
    items: [{ id: String.fromCharCode(55296), title: "Invalid" }],
    current: "igs", page: PAGE, onEvent: () => seen.push("failed"),
  }), URIError);
  assert.equal(h.html(), before);
  h.fire("click", node({ "data-row": "t1", "aria-checked": "false" }));
  assert.deepEqual(seen, ["previous"]);
  mounted.update({ current: "igs", page: { id: "igs", title: "Integrations", sections: [] } });
  assert.ok(h.html().includes("Integrations"));
  mounted.dispose();
});

test("separate mounts use distinct IDs and keep them stable on update", () => {
  const a = host(), b = host();
  const first = mountSettings(a, { items: ITEMS, current: "inf", page: PAGE });
  mountSettings(b, { items: ITEMS, current: "inf", page: PAGE });
  const id = (h: typeof a) => h.html().match(/\sid="([^"]+)"/)?.[1];
  assert.ok(id(a) && id(b));
  assert.notEqual(id(a), id(b));
  const before = id(a);
  first.update({ page: PAGE });
  assert.equal(id(a), before);
});

test("disabled controls do not emit synthetic actions", () => {
  const h = host();
  mountSettings(h, { items: ITEMS, current: "inf", page: PAGE,
    onEvent() { assert.fail("disabled control emitted"); } });
  h.fire("click", node({ "data-row": "t1", "aria-checked": "false", disabled: "" }));
});
