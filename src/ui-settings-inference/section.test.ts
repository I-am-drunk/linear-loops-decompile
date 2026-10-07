/** ST3: the provider-to-rows mapping. Pure functions, no DOM, no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { inferencePage, rowsForProvider, sectionsFor, type ProviderView } from "./section.ts";

const p = (over: Partial<ProviderView> & { id: string }): ProviderView => ({
  label: over.id, auth: `apiKey`, credential: { configured: false }, models: [], ...over,
});

const kinds = (v: ProviderView): string[] => rowsForProvider(v).map((r) => r.kind);

test(`a pairing provider gets NO credential row`, () => {
  // T3 Code Connect exchanges a scoped token; no long-lived key is stored.
  // A "Set API key" control would invite configuring something that does
  // not exist. docs/plan/inference.md treats this as the point of pairing.
  assert.deepEqual(kinds(p({ id: `t3`, auth: `pairing` })), [`connection`]);
});

test(`a key provider gets a credential row`, () => {
  assert.deepEqual(kinds(p({ id: `anthropic`, auth: `apiKey` })), [`connection`, `credential`]);
});

test(`an OpenAI-compatible provider also gets a base URL row`, () => {
  assert.deepEqual(kinds(p({ id: `oai`, auth: `apiKeyWithBaseUrl` })),
    [`connection`, `credential`, `text`]);
});

test(`a local provider gets a base URL and NO credential row`, () => {
  // Caught by this test: baseUrl previously produced TWO rows both labelled
  // "Base URL" — a credential row masking a value that is not a secret, plus
  // the text row. A URL is not a secret, so the write-only pattern is the
  // wrong control for it.
  assert.deepEqual(kinds(p({ id: `ollama`, auth: `baseUrl` })), [`connection`, `text`]);
  const labels = rowsForProvider(p({ id: `ollama`, auth: `baseUrl` })).map((r) => r.label);
  assert.equal(new Set(labels).size, labels.length, `duplicate label: ${labels.join(`, `)}`);
});

test(`before any reachability check the state is "checking", not "disconnected"`, () => {
  const row = rowsForProvider(p({ id: `a`, credential: { configured: true } }))[0];
  // "disconnected" would claim a failed check that never ran.
  assert.equal(row?.kind === `connection` && row.state, `checking`);
});

test(`no credentials reads as disconnected with a reason`, () => {
  const row = rowsForProvider(p({ id: `a` }))[0];
  assert.ok(row?.kind === `connection`);
  if (row.kind === `connection`) {
    assert.equal(row.state, `disconnected`);
    assert.equal(row.detail, `No credentials`);
  }
});

test(`a pairing provider is never "disconnected" for want of a key`, () => {
  // It has no key to lack. Before a check it is checking.
  const row = rowsForProvider(p({ id: `t3`, auth: `pairing` }))[0];
  assert.equal(row?.kind === `connection` && row.state, `checking`);
});

test(`reachable true/false map to connected and error`, () => {
  const up = rowsForProvider(p({ id: `a`, credential: { configured: true }, reachable: true }))[0];
  const down = rowsForProvider(p({ id: `a`, credential: { configured: true }, reachable: false }))[0];
  assert.equal(up?.kind === `connection` && up.state, `connected`);
  assert.equal(down?.kind === `connection` && down.state, `error`);
});

test(`the model select appears only once models are known`, () => {
  assert.ok(!kinds(p({ id: `a`, credential: { configured: true }, reachable: true })).includes(`select`));
  const withModels = p({
    id: `a`, credential: { configured: true }, reachable: true,
    models: [{ id: `m1`, label: `M1` }, { id: `m2`, label: `M2` }],
  });
  assert.ok(kinds(withModels).includes(`select`));
});

test(`model count shows on a connected provider, pluralized`, () => {
  const one = rowsForProvider(p({ id: `a`, credential: { configured: true }, reachable: true,
    models: [{ id: `m`, label: `M` }] }))[0];
  assert.equal(one?.kind === `connection` && one.detail, `1 model`);
  const two = rowsForProvider(p({ id: `a`, credential: { configured: true }, reachable: true,
    models: [{ id: `m`, label: `M` }, { id: `n`, label: `N` }] }))[0];
  assert.equal(two?.kind === `connection` && two.detail, `2 models`);
});

test(`credential hint passes through but no secret field exists`, () => {
  const rows = rowsForProvider(p({ id: `a`, credential: { configured: true, hint: `…4f2a` } }));
  const cred = rows.find((r) => r.kind === `credential`);
  assert.ok(cred && cred.kind === `credential`);
  if (cred?.kind === `credential`) {
    assert.equal(cred.hint, `…4f2a`);
    assert.ok(!(`value` in cred), `a credential row must carry no value field`);
  }
});

test(`sections keep registry order and pairing gets an explanatory blurb`, () => {
  const out = sectionsFor([
    p({ id: `t3`, label: `T3 Code Connect`, auth: `pairing` }),
    p({ id: `anthropic`, label: `Anthropic` }),
  ]);
  assert.deepEqual(out.map((s) => s.id), [`t3`, `anthropic`]);
  assert.match(out[0]?.blurb ?? ``, /Paired, not keyed/);
  assert.equal(out[1]?.blurb, undefined);
});

test(`inferencePage is shaped for the settings shell`, () => {
  const page = inferencePage([p({ id: `a`, label: `A` })]);
  assert.equal(page.id, `inference`);
  assert.equal(page.title, `Inference`);
  assert.equal(page.sections.length, 1);
});
