/**
 * Theme-input hashing: exact reproduction of the object-hash serialization
 * the corpus theme generator uses (`object_hash.B923Anbb.js` — the bundled
 * `object-hash` npm package — called from `ThemeHelper.CeMKYPhf.js` with
 * `{ encoding: "hex", respectType: false, unorderedObjects: true,
 * unorderedArrays: false }`, algorithm defaulting to sha1).
 *
 * Only the value kinds a theme input can contain are implemented (object,
 * array, string, number, boolean, null, undefined, function); an unknown
 * kind throws, matching the upstream behavior of surfacing rather than
 * silently mis-hashing. Serialization tags (`object:N:`, `array:N:`,
 * `string:N:`, `number:`, `bool:`, `Null`, `Undefined`, `fn:`,
 * `function-name:`) are byte-identical to upstream.
 */

import { createHash } from "node:crypto";

type Writer = (chunk: string) => void;

function dispatch(value: unknown, write: Writer, seen: unknown[]): void {
  if (value === null) {
    write(`Null`);
    return;
  }
  switch (typeof value) {
    case `object`:
      hashObject(value as object, write, seen);
      return;
    case `string`:
      write(`string:` + (value as string).length + `:`);
      write(value as string);
      return;
    case `number`:
      write(`number:` + (value as number).toString());
      return;
    case `boolean`:
      write(`bool:` + (value as boolean).toString());
      return;
    case `undefined`:
      write(`Undefined`);
      return;
    case `function`:
      hashFunction(value as (...args: unknown[]) => unknown, write, seen);
      return;
    default:
      throw new Error(`theme hash: unsupported value type "${typeof value}"`);
  }
}

function hashObject(value: object, write: Writer, seen: unknown[]): void {
  const circularAt = seen.indexOf(value);
  if (circularAt >= 0) {
    dispatch(`[CIRCULAR:` + circularAt + `]`, write, seen);
    return;
  }
  seen.push(value);
  if (Array.isArray(value)) {
    // unorderedArrays: false — declared order hashes as-is
    write(`array:` + value.length + `:`);
    for (const item of value) dispatch(item, write, seen);
    return;
  }
  // unorderedObjects: true — keys sort; respectType: false — no prototype keys
  const keys = Object.keys(value).sort();
  write(`object:` + keys.length + `:`);
  for (const key of keys) {
    dispatch(key, write, seen);
    write(`:`);
    dispatch((value as Record<string, unknown>)[key], write, seen);
    write(`,`);
  }
}

const NATIVE_FN_REGEX = /^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i;

function hashFunction(fn: (...args: unknown[]) => unknown, write: Writer, seen: unknown[]): void {
  write(`fn:`);
  if (NATIVE_FN_REGEX.exec(Function.prototype.toString.call(fn)) != null) {
    dispatch(`[native]`, write, seen);
  } else {
    dispatch(fn.toString(), write, seen);
  }
  // respectFunctionNames defaults true
  dispatch(`function-name:` + String(fn.name), write, seen);
  // respectFunctionProperties defaults true
  hashObject(fn, write, seen);
}

/** sha1-hex object hash with the theme generator's exact options. */
export function themeObjectHash(value: unknown): string {
  const sha1 = createHash(`sha1`);
  dispatch(value, (chunk) => sha1.update(chunk, `utf8`), []);
  return sha1.digest(`hex`);
}
