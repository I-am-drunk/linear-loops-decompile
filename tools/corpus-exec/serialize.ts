/**
 * Deterministic serialization of executed-corpus outputs.
 *
 * - Plain data: JSON with sorted object keys (byte-stable across runs).
 * - React elements (render mode): `{ $element, type, props, children }`
 *   trees. A composite (function-component) child is NOT silently rendered:
 *   it serializes as `{ $composite: <name> }` so the golden names the
 *   boundary and a reviewer sees exactly where the tree was cut. Rendering
 *   through a composite is the author's explicit call (a separate case with
 *   that component as the entry).
 * - Functions and symbols anywhere else are a loud error: a golden holding
 *   an unserializable value is not a fact.
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

function isReactElement(v: unknown): v is { type: unknown; props: Record<string, unknown> | null } {
  return typeof v === `object` && v !== null && `type` in v && `props` in v
    && typeof (v as { $$typeof?: unknown }).$$typeof === `symbol`;
}

export function serialize(value: unknown, path = `$`): Json {
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
  if (Array.isArray(value)) return value.map((v, i) => serialize(v, `${path}[${i}]`));
  if (isReactElement(value)) {
    const el = value as { type: unknown; props: Record<string, unknown> | null };
    if (typeof el.type === `function`) {
      const name = (el.type as { name?: string }).name ?? `anonymous`;
      return { $composite: name };
    }
    const props: { [k: string]: Json } = {};
    let children: Json = null;
    const raw = el.props ?? {};
    for (const key of Object.keys(raw).sort()) {
      if (key === `children`) {
        children = serialize(raw[key], `${path}.children`);
      } else {
        props[key] = serialize(raw[key], `${path}.${key}`);
      }
    }
    return { $element: true, type: String(el.type), props, children };
  }
  const obj = value as Record<string, unknown>;
  const out: { [k: string]: Json } = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = serialize(obj[key], `${path}.${key}`);
  }
  return out;
}

/** Sorted-key stringify (serialize() already sorted; JSON.stringify keeps insertion order). */
export function stringify(value: unknown): string {
  return `${JSON.stringify(serialize(value), null, 2)}\n`;
}
