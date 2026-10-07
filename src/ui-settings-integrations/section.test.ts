/** ST4: integration-to-rows mapping. Pure; no OAuth, no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { integrationsPage, rowsForIntegration, sectionsFor } from "./section.ts";
import type { Integration, IntegrationStatus } from "../integrations/types.ts";

const integ = (id: string, over: Partial<Integration> = {}): Integration => ({
  id, name: id, auth: { kind: `token` }, status: () => ({ state: `checking` }),
  entities: [], events: [], actions: [], ...over,
});

const kinds = (i: Integration): string[] => rowsForIntegration(i).map((r) => r.kind);
const first = (i: Integration) => rowsForIntegration(i)[0];

test(`a pairing integration gets ONLY a connection row — no credential to configure`, () => {
  assert.deepEqual(kinds(integ(`t3`, { auth: { kind: `pairing` } })), [`connection`]);
});

test(`a token integration gets a write-only credential row`, () => {
  assert.deepEqual(kinds(integ(`gh`)), [`connection`, `credential`]);
  const cred = rowsForIntegration(integ(`gh`))[1];
  assert.ok(cred?.kind === `credential` && !(`value` in cred), `a credential row carries no value`);
});

test(`an oauth2 integration shows its scopes, read-only; the flow itself is IG2`, () => {
  const i = integ(`linear`, { auth: { kind: `oauth2`, scopes: [`read`, `write`] } });
  assert.deepEqual(kinds(i), [`connection`, `text`]);
  const scopes = rowsForIntegration(i)[1];
  assert.ok(scopes?.kind === `text` && scopes.value === `read write` && scopes.disabled === true);
});

test(`status maps onto the connection row: state, and a detail only where one exists`, () => {
  const at = (s: IntegrationStatus) => first(integ(`x`, { status: () => s }));
  const connected = at({ state: `connected`, account: `acme` });
  assert.ok(connected?.kind === `connection` && connected.state === `connected` && connected.detail === `acme`);
  const err = at({ state: `error`, detail: `401 from provider` });
  assert.ok(err?.kind === `connection` && err.state === `error` && err.detail === `401 from provider`);
  const off = at({ state: `disconnected` });
  assert.ok(off?.kind === `connection` && off.detail === `Not connected`);
  // checking has no detail: nothing has happened yet to describe.
  const chk = at({ state: `checking` });
  assert.ok(chk?.kind === `connection` && chk.state === `checking` && !(`detail` in chk));
});

test(`status is read LIVE at render, not captured when the section is built`, () => {
  let s: IntegrationStatus = { state: `checking` };
  const i = integ(`x`, { status: () => s });
  // Narrow once into a local, so `.state` reads on the connection variant.
  const stateOf = (): string | undefined => {
    const r = first(i);
    return r?.kind === `connection` ? r.state : undefined;
  };
  assert.equal(stateOf(), `checking`);
  s = { state: `connected`, account: `acme` };
  // A snapshot taken earlier would still say checking here.
  assert.equal(stateOf(), `connected`);
});

test(`the blurb says what connecting unlocks, pluralized`, () => {
  const ev = { kind: `e`, label: ``, entity: `x`, delivery: `webhook` as const, dedupeKey: `id`, payload: [] };
  const act = { kind: `a`, label: ``, inputs: [], idempotent: true };
  assert.equal(sectionsFor([integ(`a`, { events: [ev], actions: [] })])[0]?.blurb, `1 trigger · 0 actions`);
  assert.equal(sectionsFor([integ(`b`, { events: [ev, ev], actions: [act] })])[0]?.blurb, `2 triggers · 1 action`);
});

test(`sections keep registry order`, () => {
  const out = sectionsFor([integ(`slack`), integ(`linear`)]);
  assert.deepEqual(out.map((s) => s.id), [`slack`, `linear`]);
});

test(`integrationsPage is shaped for the settings shell`, () => {
  const page = integrationsPage([integ(`a`)]);
  assert.equal(page.id, `integrations`);
  assert.equal(page.title, `Integrations`);
  assert.equal(page.sections.length, 1);
});
