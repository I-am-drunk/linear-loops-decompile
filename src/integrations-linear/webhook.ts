/**
 * Linear webhook receiver (IG4, docs/plan/integrations.md).
 *
 * A pure verify-and-parse kernel built from Linear's public webhook docs,
 * digested at extracts/linear-official/docs-site/webhooks.md. Both
 * verification steps there are documented as required practice:
 *
 *   1. HMAC-SHA256 the RAW body with the signing secret; timing-safe
 *      compare to `Linear-Signature`. Never a restringified parse — a
 *      re-serialized body can differ byte-for-byte and the MAC will not
 *      match, which looks like an attack and is actually a bug.
 *   2. Reject when `webhookTimestamp` is more than ~1 minute from now.
 *
 * Plus the plan's rule: delivery is at-least-once, so dedupe on
 * `Linear-Delivery` is mandatory, not an optimization. The seen-set is
 * injected; this file holds no state. The 5-second response budget and the
 * 500-so-Linear-retries contract belong to the HTTP seam, not here.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

/** The headers webhooks.md names. Lower-cased keys, as Node's http gives them. */
export type WebhookHeaders = {
  "linear-delivery"?: string;
  "linear-event"?: string;
  "linear-signature"?: string;
  "linear-timestamp"?: string;
};

/** Already-seen delivery ids. A Set works; a store-backed one is the server's. */
export type SeenSet = { has(id: string): boolean; add(id: string): void };

export type WebhookVerdict =
  | { ok: true; deliveryId: string; event: ParsedEvent }
  | { ok: false; reason: `badSignature` | `stale` | `duplicate` | `malformed`; detail: string };

/** HMAC-SHA256 of the RAW body, timing-safe. Returns false on any shape fault. */
export function signatureValid(rawBody: string | Uint8Array, secret: string, header: string | undefined): boolean {
  if (!header) return false;
  const expected = createHmac(`sha256`, secret).update(rawBody).digest();
  let given: Buffer;
  try {
    given = Buffer.from(header, `hex`);
  } catch {
    return false;
  }
  // timingSafeEqual throws on length mismatch; a mismatch is simply invalid.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** What a data-change webhook tells us, shaped for the trigger catalog. */
export type ParsedEvent = {
  /** `create | update | remove`, per webhooks.md. */
  action: string;
  /** Entity type, e.g. `Issue`, as Linear sends it. */
  type: string;
  /** `issue.update` — the IntegrationEvent kind IG6 registers. */
  kind: string;
  data: Record<string, unknown>;
  /** Previous values of changed props on `update`; absent otherwise. */
  updatedFrom?: Record<string, unknown>;
  webhookTimestamp: number;
  url?: string;
};

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  v && typeof v === `object` && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;

/** Default replay window. webhooks.md says "~1 minute"; 60s is that, exactly. */
export const REPLAY_WINDOW_MS = 60_000;

/** Parse a verified body. Unknown shapes are `malformed`, never guessed at. */
export function parseEvent(rawBody: string): ParsedEvent | undefined {
  let j: unknown;
  try { j = JSON.parse(rawBody); } catch { return undefined; }
  const r = asRecord(j);
  const action = r?.[`action`], type = r?.[`type`], ts = r?.[`webhookTimestamp`];
  const data = asRecord(r?.[`data`]);
  if (typeof action !== `string` || typeof type !== `string` || typeof ts !== `number` || !data) return undefined;
  const updatedFrom = asRecord(r?.[`updatedFrom`]);
  const url = r?.[`url`];
  return {
    action, type,
    // `Issue` + `update` -> `issue.update`: lower-cased type, dotted action.
    kind: `${type.toLowerCase()}.${action}`,
    data,
    ...(updatedFrom ? { updatedFrom } : {}),
    webhookTimestamp: ts,
    ...(typeof url === `string` ? { url } : {}),
  };
}

/**
 * The whole recipe in order: signature, then freshness, then dedupe, then
 * parse. Order matters — an unsigned body is never parsed, and a stale one
 * is never added to the seen-set, so a replay cannot poison dedupe.
 */
export function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  seen: SeenSet,
  now: () => number = () => Date.now(),
  windowMs: number = REPLAY_WINDOW_MS,
): WebhookVerdict {
  if (!signatureValid(rawBody, secret, headers[`linear-signature`])) {
    return { ok: false, reason: `badSignature`, detail: `Linear-Signature did not match the raw body` };
  }
  const deliveryId = headers[`linear-delivery`];
  if (!deliveryId) return { ok: false, reason: `malformed`, detail: `no Linear-Delivery header` };
  const event = parseEvent(rawBody);
  if (!event) return { ok: false, reason: `malformed`, detail: `body is not a data-change webhook` };
  const skew = Math.abs(now() - event.webhookTimestamp);
  if (skew > windowMs) return { ok: false, reason: `stale`, detail: `webhookTimestamp is ${skew}ms from now` };
  if (seen.has(deliveryId)) return { ok: false, reason: `duplicate`, detail: `delivery ${deliveryId} already processed` };
  seen.add(deliveryId);
  return { ok: true, deliveryId, event };
}
