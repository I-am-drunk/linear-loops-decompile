/** IG4: webhook verify-and-parse kernel. Pure; no HTTP server. */

import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { parseEvent, REPLAY_WINDOW_MS, signatureValid, verifyWebhook, type WebhookHeaders } from "./webhook.ts";

const SECRET = `whsec_test`;
const NOW = Date.parse(`2026-10-05T12:00:00Z`);
const sign = (body: string, secret = SECRET): string => createHmac(`sha256`, secret).update(body).digest(`hex`);

/** A valid data-change body at time `ts`, with optional extra fields. */
const body = (ts = NOW, extra: Record<string, unknown> = {}): string => JSON.stringify({
  action: `update`, type: `Issue`, webhookTimestamp: ts, webhookId: `w1`, organizationId: `o1`,
  data: { id: `i1`, identifier: `ENG-1`, title: `Fix` }, url: `https://linear.app/x/ENG-1`, ...extra,
});

const headersFor = (raw: string, delivery = `d-1`, secret = SECRET): WebhookHeaders => ({
  "linear-delivery": delivery, "linear-event": `Issue`, "linear-signature": sign(raw, secret), "linear-timestamp": String(NOW),
});

const seen = () => new Set<string>();
const at = (t: number) => () => t;

test(`signatureValid: HMAC of the RAW body, hex, timing-safe; wrong secret, tampered body, or garbage all fail`, () => {
  const raw = body();
  assert.equal(signatureValid(raw, SECRET, sign(raw)), true);
  assert.equal(signatureValid(raw, `wrong`, sign(raw)), false, `wrong secret`);
  assert.equal(signatureValid(raw + ` `, SECRET, sign(raw)), false, `one byte changed`);
  assert.equal(signatureValid(raw, SECRET, undefined), false, `no header`);
  assert.equal(signatureValid(raw, SECRET, `zz-not-hex`), false, `not hex`);
  assert.equal(signatureValid(raw, SECRET, sign(raw).slice(0, 20)), false, `wrong length`);
});

test(`a restringified parse does NOT verify — the MAC is over the raw bytes`, () => {
  const raw = `{"action":"update",  "type":"Issue","webhookTimestamp":${NOW},"data":{"id":"i1"}}`;
  const restringified = JSON.stringify(JSON.parse(raw));
  assert.notEqual(raw, restringified, `the fixture must differ byte-wise`);
  assert.equal(signatureValid(raw, SECRET, sign(raw)), true);
  // Verifying the re-serialized body against the original signature fails,
  // which is why the kernel takes the raw body and never a parsed object.
  assert.equal(signatureValid(restringified, SECRET, sign(raw)), false);
});

test(`parseEvent shapes a data-change body and derives the catalog kind`, () => {
  const e = parseEvent(body(NOW, { updatedFrom: { title: `Old` } }));
  assert.ok(e);
  assert.equal(e?.kind, `issue.update`, `lower-cased type, dotted action`);
  assert.equal(e?.action, `update`);
  assert.equal(e?.type, `Issue`);
  assert.deepEqual(e?.data, { id: `i1`, identifier: `ENG-1`, title: `Fix` });
  assert.deepEqual(e?.updatedFrom, { title: `Old` });
  assert.equal(e?.url, `https://linear.app/x/ENG-1`);
  // No updatedFrom on a create: the key is absent, not an empty object.
  assert.ok(!(`updatedFrom` in (parseEvent(body(NOW, { action: `create` })) ?? {})));
});

test(`parseEvent returns undefined for anything that is not a data-change webhook`, () => {
  assert.equal(parseEvent(`not json`), undefined);
  assert.equal(parseEvent(`[]`), undefined);
  assert.equal(parseEvent(JSON.stringify({ action: `update`, type: `Issue` })), undefined, `no timestamp/data`);
  assert.equal(parseEvent(JSON.stringify({ action: 1, type: `Issue`, webhookTimestamp: NOW, data: {} })), undefined);
});

test(`verifyWebhook: a signed, fresh, first-seen delivery passes and is recorded`, () => {
  const raw = body();
  const s = seen();
  const v = verifyWebhook(raw, headersFor(raw), SECRET, s, at(NOW));
  assert.ok(v.ok);
  if (v.ok) {
    assert.equal(v.deliveryId, `d-1`);
    assert.equal(v.event.kind, `issue.update`);
  }
  assert.ok(s.has(`d-1`), `the delivery id must be recorded for dedupe`);
});

test(`a bad signature is refused BEFORE parsing or dedupe — nothing is recorded`, () => {
  const raw = body();
  const s = seen();
  const v = verifyWebhook(raw, headersFor(raw, `d-1`, `wrong-secret`), SECRET, s, at(NOW));
  assert.equal(v.ok === false && v.reason, `badSignature`);
  assert.equal(s.has(`d-1`), false, `an unsigned delivery must never enter the seen-set`);
});

test(`a stale timestamp is refused and NOT recorded, so a replay cannot poison dedupe`, () => {
  const old = body(NOW - REPLAY_WINDOW_MS - 1);
  const s = seen();
  const v = verifyWebhook(old, headersFor(old), SECRET, s, at(NOW));
  assert.equal(v.ok === false && v.reason, `stale`);
  assert.equal(s.has(`d-1`), false);
  // Exactly at the window edge is still fresh; one ms past is stale.
  const edge = body(NOW - REPLAY_WINDOW_MS);
  assert.ok(verifyWebhook(edge, headersFor(edge, `d-edge`), SECRET, seen(), at(NOW)).ok);
  // Future skew is rejected too — a clock that is ahead is not a free pass.
  const future = body(NOW + REPLAY_WINDOW_MS + 1);
  assert.equal(verifyWebhook(future, headersFor(future, `d-f`), SECRET, seen(), at(NOW)).ok, false);
});

test(`a second delivery with the same id is a duplicate — at-least-once makes this mandatory`, () => {
  const raw = body();
  const s = seen();
  assert.ok(verifyWebhook(raw, headersFor(raw), SECRET, s, at(NOW)).ok);
  const again = verifyWebhook(raw, headersFor(raw), SECRET, s, at(NOW));
  assert.equal(again.ok === false && again.reason, `duplicate`);
  // A different delivery id of the same body is a new event, not a dup.
  assert.ok(verifyWebhook(raw, headersFor(raw, `d-2`), SECRET, s, at(NOW)).ok);
});

test(`a missing Linear-Delivery header or a non-webhook body is malformed, after the signature passes`, () => {
  const raw = body();
  const noId = { ...headersFor(raw) }; delete noId[`linear-delivery`];
  const v1 = verifyWebhook(raw, noId, SECRET, seen(), at(NOW));
  assert.equal(v1.ok === false && v1.reason, `malformed`);
  const junk = `{"hello":"world"}`;
  const v2 = verifyWebhook(junk, headersFor(junk), SECRET, seen(), at(NOW));
  assert.equal(v2.ok === false && v2.reason, `malformed`);
});
