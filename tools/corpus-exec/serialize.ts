/**
 * Deterministic, injective serialization for observed corpus outputs.
 *
 * Goldens are a byte oracle only when distinct accepted JavaScript values
 * produce distinct bytes. This module therefore emits a closed, recursively
 * tagged JSON grammar. It never uses a sentinel string (which ordinary corpus
 * output could equal) or an ordinary object shape as a type channel. Values
 * outside that grammar fail loudly with a path rather than being projected
 * silently.
 *
 * Serializable value classes:
 * - null, undefined, booleans, strings, numbers (including -0/non-finite),
 *   bigint, Date;
 * - dense or sparse ordinary arrays (holes are explicit);
 * - plain/null-prototype objects with ordinary enumerable data properties;
 * - host React elements, observed as type + key + props. Composite elements
 *   require the T2 renderer and refuse here.
 *
 * Rejected values include functions, symbols, accessors, symbols/non-enumerable
 * or nonstandard descriptors, non-plain instances, cycles, and composite React
 * elements. A driver must explicitly project such a value to supported data.
 */

/** Bump on every encoding change: old goldens must be deliberately re-recorded. */
export const SERIALIZER_VERSION = `corpus-exec-tagged-json-v2`;

export type Tagged =
  | { tag: `null` }
  | { tag: `undefined` }
  | { tag: `boolean`; value: boolean }
  | { tag: `string`; value: string }
  | { tag: `number`; value: string }
  | { tag: `bigint`; value: string }
  | { tag: `date`; value: string }
  | { tag: `hole` }
  | { tag: `array`; values: Tagged[] }
  | { tag: `object`; prototype: `object` | `null`; properties: Array<{ key: string; value: Tagged }> }
  | { tag: `element`; type: string; key: Tagged; props: Tagged };

type ReactElementSnapshot = { type: unknown; key: unknown; props: unknown; ownNames: string[]; hasRef: boolean; ref: unknown };

function dataDescriptor(value: object, key: string): PropertyDescriptor | undefined {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && `value` in descriptor ? descriptor : undefined;
}

/**
 * Detect and snapshot a real React element without invoking user-defined
 * getters. A forged/partial element marker is a loud error, never an ordinary
 * object fallback: otherwise a malformed element could evade element policy.
 */
function reactElementSnapshot(value: object, path: string): ReactElementSnapshot | undefined {
  const marker = dataDescriptor(value, `$$typeof`);
  if (marker === undefined || typeof marker.value !== `symbol`) return undefined;
  const markerName = Symbol.keyFor(marker.value);
  if (markerName !== `react.element` && markerName !== `react.transitional.element`) return undefined;
  const type = dataDescriptor(value, `type`);
  const key = dataDescriptor(value, `key`);
  const props = dataDescriptor(value, `props`);
  if (type === undefined || key === undefined || props === undefined) {
    throw new Error(`malformed React element at ${path} — marker requires own data type, key, and props`);
  }
  const ref = Object.getOwnPropertyDescriptor(value, `ref`);
  if (ref !== undefined && !(`value` in ref)) {
    throw new Error(`unserializable React ref at ${path} — a T1 golden cannot invoke a ref getter`);
  }
  return {
    type: type.value,
    key: key.value,
    props: props.value,
    ownNames: Object.getOwnPropertyNames(value),
    hasRef: ref !== undefined,
    ref: ref !== undefined && `value` in ref ? ref.value : undefined,
  };
}

function constructorName(value: object): string {
  const proto = Object.getPrototypeOf(value) as { constructor?: { name?: string } } | null;
  return proto?.constructor?.name ?? `null-prototype`;
}

function numberText(value: number): string {
  if (Number.isNaN(value)) return `NaN`;
  if (value === Infinity) return `Infinity`;
  if (value === -Infinity) return `-Infinity`;
  if (Object.is(value, -0)) return `-0`;
  return String(value);
}

function rejectDescriptor(path: string, key: string, reason: string): never {
  throw new Error(`unserializable property ${JSON.stringify(key)} at ${path} — ${reason}`);
}

/**
 * Read only ordinary own data properties without invoking getters. The output
 * grammar deliberately excludes descriptor flags, so nonstandard descriptors
 * refuse instead of silently collapsing distinct objects to the same bytes.
 */
function ordinaryProperties(value: object, path: string): Array<{ key: string; value: unknown }> {
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    throw new Error(`unserializable symbol property at ${path} — project it to plain data in the driver`);
  }
  const out: Array<{ key: string; value: unknown }> = [];
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    if (!(`value` in descriptor)) rejectDescriptor(path, key, `accessors are not a stable golden value`);
    if (!descriptor.enumerable || !descriptor.writable || !descriptor.configurable) {
      rejectDescriptor(path, key, `nonstandard property descriptors are not a stable golden value`);
    }
    out.push({ key, value: descriptor.value });
  }
  return out;
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && index < 2 ** 32 - 1 && String(index) === key;
}

function serializeArray(value: unknown[], path: string, seen: Set<object>): Tagged {
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    throw new Error(`unserializable symbol property at ${path} — project it to plain data in the driver`);
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) continue;
    if (key === `length`) {
      if (!(`value` in descriptor) || descriptor.value !== value.length || descriptor.enumerable || descriptor.configurable || !descriptor.writable) {
        rejectDescriptor(path, key, `array length has a nonstandard descriptor`);
      }
      continue;
    }
    if (!isArrayIndex(key, value.length)) rejectDescriptor(path, key, `arrays may only carry indexed elements`);
    if (!(`value` in descriptor) || !descriptor.enumerable || !descriptor.writable || !descriptor.configurable) {
      rejectDescriptor(path, key, `array elements must be ordinary enumerable data properties`);
    }
  }
  const values: Tagged[] = [];
  for (let index = 0; index < value.length; index += 1) {
    values.push(Object.prototype.hasOwnProperty.call(value, index)
      ? serialize(value[index], `${path}[${index}]`, seen)
      : { tag: `hole` });
  }
  return { tag: `array`, values };
}

function serializeElement(value: object, snapshot: ReactElementSnapshot, path: string, seen: Set<object>): Tagged {
  const allowed = new Set([`$$typeof`, `type`, `key`, `props`, `ref`, `_owner`, `_store`, `_debugInfo`, `_debugStack`, `_debugTask`]);
  for (const property of snapshot.ownNames) {
    if (!allowed.has(property)) throw new Error(`unserializable extra React element property ${JSON.stringify(property)} at ${path}`);
  }
  if (Object.getOwnPropertySymbols(value).length > 0) throw new Error(`unserializable symbol property at ${path} — project it to plain data in the driver`);
  if (snapshot.hasRef && snapshot.ref !== null) {
    throw new Error(`unserializable React ref at ${path} — a T1 golden cannot silently discard ref identity`);
  }
  if (typeof snapshot.type !== `string`) {
    const kind = typeof snapshot.type === `function` ? `composite` : `non-host`;
    throw new Error(`unserializable ${kind} React element at ${path} — render it with the T2 renderer, not the T1 micro-dispatcher`);
  }
  return {
    tag: `element`,
    type: snapshot.type,
    key: serialize(snapshot.key, `${path}.key`, seen),
    props: serialize(snapshot.props, `${path}.props`, seen),
  };
}

/** Convert a supported runtime value to the closed tagged JSON grammar. */
export function serialize(value: unknown, path = `$`, seen?: Set<object>): Tagged {
  if (value === null) return { tag: `null` };
  if (value === undefined) return { tag: `undefined` };
  switch (typeof value) {
    case `boolean`: return { tag: `boolean`, value };
    case `string`: return { tag: `string`, value };
    case `number`: return { tag: `number`, value: numberText(value) };
    case `bigint`: return { tag: `bigint`, value: String(value) };
    case `function`:
    case `symbol`:
      throw new Error(`unserializable ${typeof value} at ${path} — a golden must hold values, not references`);
    default:
      break;
  }

  const object = value as object;
  const track = seen ?? new Set<object>();
  if (track.has(object)) throw new Error(`cycle at ${path} — a golden must be a finite value`);
  track.add(object);
  try {
    if (value instanceof Date) {
      if (Object.getPrototypeOf(value) !== Date.prototype || Object.getOwnPropertyNames(value).length > 0 || Object.getOwnPropertySymbols(value).length > 0) {
        throw new Error(`unserializable decorated Date at ${path} — project it to plain data in the driver`);
      }
      if (Number.isNaN(value.getTime())) throw new Error(`invalid Date at ${path} — pin the input or fix the driver`);
      return { tag: `date`, value: value.toISOString() };
    }
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) throw new Error(`unserializable Array subclass at ${path} — project it to plain data in the driver`);
      return serializeArray(value, path, track);
    }
    const element = reactElementSnapshot(object, path);
    if (element !== undefined) return serializeElement(object, element, path, track);

    const prototype = Object.getPrototypeOf(object);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`unserializable ${constructorName(object)} at ${path} — project it to plain data in the driver (an instance's meaning is the author's call, never the serializer's)`);
    }
    return {
      tag: `object`,
      prototype: prototype === null ? `null` : `object`,
      properties: ordinaryProperties(object, path).map(({ key, value: propertyValue }) => ({
        key,
        value: serialize(propertyValue, `${path}.${key}`, track),
      })),
    };
  } finally {
    track.delete(object);
  }
}

/** Stable bytes for a supported runtime value. */
export function stringify(value: unknown): string {
  return `${JSON.stringify(serialize(value), null, 2)}\n`;
}
