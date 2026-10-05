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

function host(): Elementish & { fire(type: string, target: AttrNode | null): void; html(): string } {
  const handlers: Record<string, ((e: EventLike) => void)[]> = {};
  let inner = ``;
  return {
    get innerHTML() { return inner; },
    set innerHTML(v: string) { inner = v; },
    addEventListener(type, handler) { (handlers[type] ??= []).push(handler); },
    querySelector: () => null,
    fire(type, target) { for (const h of handlers[type] ?? []) h({ type, target }); },
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
