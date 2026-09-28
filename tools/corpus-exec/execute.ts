import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Closure } from "./sandbox.ts";
import type { CaseFile } from "./run.ts";
import { serialize } from "./serialize.ts";

/** The render-phase micro-dispatcher. Unimplemented hooks throw loudly. */
function makeDispatcher(contextValue: unknown): Record<string, unknown> {
  return {
    useContext: () => contextValue,
    useState: (init: unknown) => [typeof init === `function` ? (init as () => unknown)() : init, () => undefined],
    useReducer: (_r: unknown, init: unknown, initFn?: unknown) => [typeof initFn === `function` ? (initFn as (a: unknown) => unknown)(init) : init, () => undefined],
    useMemo: (f: () => unknown) => f(),
    useCallback: (f: unknown) => f,
    useRef: (v: unknown) => ({ current: v }),
    useEffect: () => undefined,
    useLayoutEffect: () => undefined,
    useInsertionEffect: () => undefined,
    useSyncExternalStore: (_sub: unknown, getSnapshot: () => unknown) => getSnapshot(),
    useId: () => `:golden:`,
    useDebugValue: () => undefined,
    useTransition: () => [false, (f: () => void) => f()],
    useDeferredValue: (v: unknown) => v,
  };
}

export async function execute(closure: Closure, c: CaseFile): Promise<unknown> {
  const caseDir = "/case";
  const entryUrl = pathToFileURL(join(closure.dir, closure.entry)).href;
  const mod = (await import(entryUrl)) as Record<string, unknown>;

  let output: unknown;
  if (c.drive !== undefined) {
    const driverUrl = pathToFileURL(join(caseDir, c.drive.file)).href;
    const driver = (await import(driverUrl)) as { default?: unknown };
    if (typeof driver.default !== `function`) {
      throw new Error(`driver ${c.drive.file} must default-export a function`);
    }
    const sandboxApi = {
      entry: mod,
      load: async (ref: string): Promise<unknown> => {
        let name = ref;
        if (!closure.chunks.includes(ref)) {
          // Prefix resolution mirrors entry/stub resolution: exactly one
          // match or a loud error — first-sorted-match silently loads the
          // wrong chunk on real collisions like time.{DmD2zwKn,Dn7wnS7i}.
          const matches = closure.chunks.filter((n) => n.startsWith(`${ref}.`));
          if (matches.length === 0) throw new Error(`driver load("${ref}"): not in the sandbox closure`);
          if (matches.length > 1) throw new Error(`driver load("${ref}") is ambiguous in this closure: ${matches.join(`, `)} — pin the full name`);
          name = matches[0];
        }
        return import(pathToFileURL(join(closure.dir, name)).href);
      },
    };
    output = await (driver.default as (s: typeof sandboxApi) => unknown)(sandboxApi);
  } else if (c.invoke !== undefined) {
    // "export" takes a dotted path for object exports, e.g. "t.generateTheme".
    const path = c.invoke.export.split(`.`);
    let fn: unknown = mod;
    for (const seg of path) fn = (fn as Record<string, unknown> | undefined)?.[seg];
    if (typeof fn !== `function`) {
      throw new Error(`export "${c.invoke.export}" of ${closure.entry} is ${typeof fn}, not a function (exports: ${Object.keys(mod).join(`, `)})`);
    }
    output = (fn as (...a: unknown[]) => unknown)(...(c.invoke.args ?? []));
  } else {
    const r = c.render as NonNullable<CaseFile[`render`]>;
    const component = mod[r.export];
    if (typeof component !== `function`) {
      throw new Error(`export "${r.export}" of ${closure.entry} is ${typeof component}, not a function component`);
    }
    const reactChunk = r.reactChunk ?? closure.chunks.find((n) => /^react\./.test(n));
    if (reactChunk === undefined) {
      throw new Error(`render mode: no react chunk in the closure and none declared (render.reactChunk)`);
    }
    if (!closure.chunks.includes(reactChunk)) throw new Error("render.reactChunk must be in the sandbox closure");
    const reactMod = (await import(pathToFileURL(join(closure.dir, reactChunk)).href)) as Record<string, unknown>;
    // The corpus react chunk exports its module factory as `t` (1.32.4:
    // react.Bfm_Hgom.js `export { t }`). Probe every exported zero-arg
    // function and take the first whose result carries the internals slot.
    const pickInternals = (react: Record<string, unknown>): { H?: unknown } | undefined =>
      (react[`__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`]
        ?? react[`__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`]) as { H?: unknown } | undefined;
    let internals: { H?: unknown } | undefined;
    let reactVersion: unknown;
    const candidates = [reactMod[`t`], ...Object.values(reactMod)].filter((v) => typeof v === `function` && (v as { length: number }).length === 0);
    for (const factory of candidates) {
      try {
        const react = (factory as () => Record<string, unknown>)();
        if (react === null || typeof react !== `object`) continue;
        const found = pickInternals(react);
        if (found !== undefined) {
          internals = found;
          reactVersion = react[`version`];
          break;
        }
      } catch {
        continue;
      }
    }
    void reactVersion;
    if (internals === undefined) throw new Error(`render mode: no export of ${reactChunk} yields a React with an internals slot`);
    const prev = internals.H;
    internals.H = makeDispatcher(r.context?.value);
    try {
      output = (component as (p: unknown) => unknown)(r.props ?? {});
    } finally {
      internals.H = prev;
    }
  }

  // Apply the declared projection, if any (see CaseFile.pick).
  if (c.pick !== undefined && output !== null && typeof output === `object` && !Array.isArray(output)) {
    const projected: Record<string, unknown> = {};
    for (const key of c.pick) projected[key] = (output as Record<string, unknown>)[key];
    output = projected;
  }

  // Serialize now so an unserializable output fails inside the run, loudly.
  const _ = serialize(output);
  void _;

  return output;
}
