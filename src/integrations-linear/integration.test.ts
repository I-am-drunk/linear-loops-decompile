/** IG6: the assembled Linear Integration and its place in the IG1 catalogs. Pure. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { linearEvents, makeLinearIntegration } from "./integration.ts";
import { makeIntegrationRegistry } from "../integrations/registry.ts";
import type { IntegrationStatus } from "../integrations/types.ts";

const integ = (status: IntegrationStatus = { state: `checking` }) =>
  makeLinearIntegration({ status: async () => status, scopes: [`read`, `write`] });

test(`events: create/update/remove for each webhook entity, plus two POLLED cycle boundaries`, () => {
  const ev = linearEvents();
  const webhook = ev.filter((e) => e.delivery === `webhook`);
  const polled = ev.filter((e) => e.delivery === `poll`);
  assert.equal(webhook.length, 5 * 3, `5 entities × create/update/remove`);
  assert.deepEqual(polled.map((e) => e.kind), [`cycle.started`, `cycle.ended`]);
  // No webhook action fires at a cycle boundary (webhooks.md): the scheduler
  // must go and ask, which is exactly what `poll` tells it.
  assert.ok(polled.every((e) => e.entity === `cycle`));
  assert.ok(ev.every((e) => e.dedupeKey.length > 0), `at-least-once delivery: every event names its dedupe key`);
});

test(`labels read as English past tense, including "removed"`, () => {
  const byKind = Object.fromEntries(linearEvents().map((e) => [e.kind, e.label]));
  assert.equal(byKind[`issue.create`], `Issue created`);
  assert.equal(byKind[`issue.update`], `Issue updated`);
  assert.equal(byKind[`issue.remove`], `Issue removed`, `not "Issue removeed"`);
  assert.equal(byKind[`project.update`], `Project updated`);
});

test(`registered into IG1, Linear's events and actions appear in the catalogs under namespaced keys`, () => {
  const reg = makeIntegrationRegistry();
  reg.register(integ());
  const triggers = reg.triggers();
  const actions = reg.actions();
  assert.equal(triggers.length, 17, `15 webhook + 2 polled`);
  assert.ok(triggers.some((t) => t.key === `linear:issue.update` && t.delivery === `webhook`));
  assert.ok(triggers.some((t) => t.key === `linear:cycle.started` && t.delivery === `poll`));
  assert.deepEqual(actions.map((a) => a.key), [`linear:comment`, `linear:setStatus`, `linear:updateIssue`, `linear:createIssue`]);
  // The page reads catalogs, never the integration: every row names its source.
  assert.ok([...triggers, ...actions].every((r) => r.integration === `linear`));
  // IG4 derives `issue.update` from a body; it must match a registered kind exactly.
  assert.ok(triggers.some((t) => t.kind === `issue.update`), `webhook.ts parseEvent kinds must be registered kinds`);
});

test(`status() is checking until the first refresh samples the live source, then tracks it`, async () => {
  let live: IntegrationStatus = { state: `connected`, account: `tj` };
  const li = makeLinearIntegration({ status: async () => live, scopes: [] });
  assert.deepEqual(li.status(), { state: `checking` }, `nothing has been asked yet`);
  assert.deepEqual(await li.refresh(), { state: `connected`, account: `tj` });
  assert.deepEqual(li.status(), { state: `connected`, account: `tj` });
  live = { state: `error`, detail: `401` };
  assert.equal(li.status().state, `connected`, `status() is the last SAMPLE, not a live read`);
  await li.refresh();
  assert.equal(li.status().state, `error`);
});
