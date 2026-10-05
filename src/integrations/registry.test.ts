/** IG1: registry + catalog projection. Pure data, no network. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeIntegrationRegistry } from "./registry.ts";
import { catalogKey, type Integration, type IntegrationEvent } from "./types.ts";

const ev = (kind: string, delivery: IntegrationEvent[`delivery`] = `webhook`): IntegrationEvent => ({
  kind, label: kind, entity: `issue`, delivery, dedupeKey: `id`, payload: [],
});

const integ = (id: string, over: Partial<Integration> = {}): Integration => ({
  id, name: id, auth: { kind: `token` }, status: () => ({ state: `checking` }),
  entities: [], events: [], actions: [], ...over,
});

test(`list() is insertion-ordered so the settings list is stable`, () => {
  const r = makeIntegrationRegistry();
  r.register(integ(`slack`));
  r.register(integ(`linear`));
  assert.deepEqual(r.list().map((i) => i.id), [`slack`, `linear`]);
});

test(`double registration throws rather than replacing silently`, () => {
  const r = makeIntegrationRegistry();
  r.register(integ(`linear`));
  assert.throws(() => r.register(integ(`linear`)), /already registered: linear/);
});

test(`get() returns undefined for an unknown id, not a throw`, () => {
  assert.equal(makeIntegrationRegistry().get(`nope`), undefined);
});

test(`catalog keys are namespaced, so two integrations can both offer issue.updated`, () => {
  const r = makeIntegrationRegistry();
  r.register(integ(`linear`, { events: [ev(`issue.updated`)] }));
  r.register(integ(`github`, { events: [ev(`issue.updated`)] }));
  const keys = r.triggers().map((t) => t.key);
  assert.deepEqual(keys, [`linear:issue.updated`, `github:issue.updated`]);
  assert.equal(new Set(keys).size, 2, `keys collided`);
  assert.equal(catalogKey(`linear`, `issue.updated`), `linear:issue.updated`);
});

test(`triggers carry delivery and dedupeKey — the scheduler needs both`, () => {
  const r = makeIntegrationRegistry();
  r.register(integ(`linear`, { events: [ev(`issue.updated`, `webhook`), ev(`cycle.started`, `poll`)] }));
  const [push, pull] = r.triggers();
  // Linear pushes issue webhooks and cannot push cycle boundaries, so the
  // scheduler has to know which events it must go and ask for.
  assert.equal(push?.delivery, `webhook`);
  assert.equal(pull?.delivery, `poll`);
  assert.equal(push?.dedupeKey, `id`, `at-least-once delivery makes dedupe mandatory`);
});

test(`actions catalog tags each row with its integration and idempotency`, () => {
  const r = makeIntegrationRegistry();
  r.register(integ(`linear`, { actions: [
    { kind: `comment`, label: `Comment`, entity: `issue`, inputs: [], idempotent: false },
    { kind: `setStatus`, label: `Set status`, entity: `issue`, inputs: [], idempotent: true },
  ] }));
  const rows = r.actions();
  assert.deepEqual(rows.map((a) => [a.key, a.idempotent]), [[`linear:comment`, false], [`linear:setStatus`, true]]);
  assert.ok(rows.every((a) => a.integration === `linear`));
});

test(`an integration with no events contributes nothing to the trigger catalog`, () => {
  const r = makeIntegrationRegistry();
  r.register(integ(`webhook-only`, { actions: [
    { kind: `send`, label: `Send`, inputs: [], idempotent: false },
  ] }));
  assert.deepEqual(r.triggers(), []);
  assert.equal(r.actions().length, 1);
});

test(`status() is live, not captured at registration`, () => {
  let state: `checking` | `connected` = `checking`;
  const r = makeIntegrationRegistry();
  r.register(integ(`linear`, { status: () => (state === `connected` ? { state, account: `tj` } : { state }) }));
  assert.equal(r.get(`linear`)?.status().state, `checking`);
  state = `connected`;
  // A snapshot taken at register() would still say checking here.
  assert.deepEqual(r.get(`linear`)?.status(), { state: `connected`, account: `tj` });
});
