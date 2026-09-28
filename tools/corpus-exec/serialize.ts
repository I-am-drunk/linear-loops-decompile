/**
 * Deterministic serialization of executed-corpus outputs.
 *
 * INJECTIVITY is the contract (versioned as SERIALIZER_VERSION, a receipt
 * field): distinct observed values produce distinct bytes, or serialization
 * refuses loudly, naming the constructor and path. "Unrepresentable ⇒ {}" is
 * a golden-forgery primitive (#230 review 2026-09-28): it lets different
 * behavior share one green golden and it blinds the ambient-coupling
 * detectors, which compare serialized bytes.
 *
 * - Plain data: JSON with sorted object keys (byte-stable across runs).
 * - `Date`: `$date:<ISO-UTC>`; an invalid Date is a loud error.
 * - `undefined` inside a container: `"$undefined"` (so `{a: undefined}`
 *   and `{a: null}` differ). A top-level `undefined` output stays `null`.
 * - React elements (render mode): `{ $element, type, key?, props, children }`
 *   trees. `key` is emitted when non-null: keys are reconciliation-identity
 *   facts (223/1,550 corpus chunks pass them). A composite (function-
 *   component) child is NOT silently rendered: it serializes as
 *   `{ $composite: <name> }` so the golden names the boundary and a reviewer
 *   sees exactly where the tree was cut. Rendering through a composite is
 *   the author's explicit call (a separate case with that component as the
 *   entry).
 * - `Map`/`Set`/`RegExp`/`Error`/typed arrays/promises/class instances (any
 *   object whose prototype is not Object.prototype or null): a typed loud
 *   error naming the constructor and path. Projecting an instance to plain
 *   data is the DRIVER's explicit, reviewed job — never the serializer's
 *   silent one.
 * - Functions and symbols anywhere: a loud error — a golden holds values,
 *   not references.
 * - Cycles: a loud error naming the path (never a stack overflow).
 */

/** Bump on ANY byte-mapping change; a changed serializer re-records goldens
 * by the corpus-refresh lane (deliberate, reviewed), never silently. */
export const SERIALIZER_VERSION = `corpus-exec-json-v1`;

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function isReactElement(v: unknown): v is { type: unknown; key: unknown; props: Record<string, unknown> | null } {
  return typeof v === `object` && v !== null && `type` in v && `props` in v
    && typeof (v as { $$typeof?: unknown }).$$typeof === `symbol`;
}

function constructorName(v: object): string {
  const proto = Object.getPrototypeOf(v) as { constructor?: { name?: string } } | null;
  return proto?.constructor?.name ?? `null-prototype`;
}

export function serialize(value: unknown, path = `$`, seen?: Set<object>): Json {
  if (value === null || value === undefined) return null;
  const t = typeof value;
  if (t === `boolean` || t === `string`) return value as boolean | string;
  if (t === `number`) {
    const n = value as number;
    if (!Number.isFinite(n)) return `$number:${String(n)}`;
    return n;
  }
  if (t === `bigint`) return `$bigint:${String(value)}`;
  if (t === `function` || t === `symbol`) {
    throw new Error(`unserializable ${t} at ${path} — a golden must hold values, not references`);
  }

  // From here value is an object. Cycle guard before any recursion.
  const obj = value as object;
  const track = seen ?? new Set<object>();
  if (track.has(obj)) {
    throw new Error(`cycle at ${path} — a golden must be a finite value`);
  }
  track.add(obj);
  try {
    return serializeObject(obj, path, track);
  } finally {
    // Path-scoped, not global: a shared non-cyclic reference (DAG) is legal.
    track.delete(obj);
  }
}

function serializeObject(value: object, path: string, track: Set<object>): Json {
  const obj = value;

  if (value instanceof Date) {
    const ms = value.getTime();
    if (Number.isNaN(ms)) throw new Error(`invalid Date at ${path} — pin the input or fix the driver`);
    return `$date:${value.toISOString()}`;
  }
  if (Array.isArray(value)) {
    return value.map((v, i) => (v === undefined ? `$undefined` : serialize(v, `${path}[${i}]`, track)));
  }
  if (isReactElement(value)) {
    const el = value as { type: unknown; key: unknown; props: Record<string, unknown> | null };
    if (typeof el.type === `function`) {
      const name = (el.type as { name?: string }).name ?? `anonymous`;
      return { $composite: name };
    }
    const props: { [k: string]: Json } = {};
    let children: Json = null;
    const raw = el.props ?? {};
    for (const key of Object.keys(raw).sort()) {
      if (key === `children`) {
        children = serialize(raw[key], `${path}.children`, track);
      } else {
        props[key] = raw[key] === undefined ? `$undefined` : serialize(raw[key], `${path}.${key}`, track);
      }
    }
    const out: { [k: string]: Json } = { $element: true, type: String(el.type) };
    if (el.key !== null && el.key !== undefined) out[`key`] = String(el.key);
    out[`props`] = props;
    out[`children`] = children;
    return out;
  }

  // Reject every non-plain object: Map/Set/RegExp/Error/typed arrays/class
  // instances. Enumerable-key-walking them maps distinct values to identical
  // bytes (Map ≡ Set ≡ {} today) — the forgery class this contract exists
  // to kill.
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(
      `unserializable ${constructorName(obj)} at ${path} — project it to plain data in the driver (an instance's meaning is the author's call, never the serializer's)`,
    );
  }

  const rec = value as Record<string, unknown>;
  const out: { [k: string]: Json } = {};
  for (const key of Object.keys(rec).sort()) {
    out[key] = rec[key] === undefined ? `$undefined` : serialize(rec[key], `${path}.${key}`, track);
  }
  return out;
}

/** Sorted-key stringify (serialize() already sorted; JSON.stringify keeps insertion order). */
export function stringify(value: unknown): string {
  return `${JSON.stringify(serialize(value), null, 2)}\n`;
}
