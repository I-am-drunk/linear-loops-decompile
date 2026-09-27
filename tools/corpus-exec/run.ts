/**
 * Case execution: load the case file, build the sandbox, execute the entry
 * chunk in `invoke` (plain function) or `render` (React function component
 * under a micro-dispatcher on the CORPUS's own React) mode, and return the
 * deterministically-serialized output plus provenance.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSandbox, type Closure, type Stub } from "./sandbox.ts";
import { serialize, stringify } from "./serialize.ts";

export type CaseFile = {
  unit: string;
  chunk: string;
  stubs?: Record<string, Stub>;
  invoke?: { export: string; exportMeaning: string; args?: unknown[] };
  /** Optional projection: keep only these top-level keys of the output.
   * For outputs that carry live function members (e.g. the theme object's
   * lazy derived-theme functions), the author names the value regions this
   * case pins; a separate case invokes the functions themselves. */
  pick?: string[];
  render?: {
    export: string;
    exportMeaning: string;
    props?: Record<string, unknown>;
    /** value returned for every useContext read; a case needing per-context
     * identity mapping is not yet expressible — split the unit instead. */
    context?: { value: unknown; why: string };
    /** chunk basename exporting the corpus React factory (default: the
     * single closure chunk matching /^react\./). */
    reactChunk?: string;
  };
  notes?: string;
};

export type RunResult = {
  provenance: {
    tool: string;
    corpusHead: string | null;
    entry: string;
    closureSize: number;
    stubbed: string[];
    chunkHashes: Record<string, string>;
  };
  output: unknown;
};

export function loadCase(path: string): CaseFile {
  const c = JSON.parse(readFileSync(path, `utf8`)) as CaseFile;
  if (typeof c.unit !== `string` || typeof c.chunk !== `string`) {
    throw new Error(`case file needs string "unit" and "chunk": ${path}`);
  }
  const modes = [c.invoke, c.render].filter((m) => m !== undefined).length;
  if (modes !== 1) throw new Error(`case file needs exactly one of "invoke" | "render": ${path}`);
  const mode = c.invoke ?? c.render;
  if (typeof mode?.export !== `string` || typeof mode?.exportMeaning !== `string`) {
    throw new Error(`the mode needs "export" and "exportMeaning" (identify the minified export with corpus evidence): ${path}`);
  }
  for (const [name, stub] of Object.entries(c.stubs ?? {})) {
    if (typeof stub.source !== `string` || typeof stub.why !== `string`) {
      throw new Error(`stub "${name}" needs "source" and "why": ${path}`);
    }
  }
  return c;
}

function gitHead(dir: string): string | null {
  try {
    return execFileSync(`git`, [`-C`, dir, `rev-parse`, `HEAD`], { encoding: `utf8` }).trim();
  } catch {
    return null;
  }
}

/** The render-phase micro-dispatcher. Unimplemented hooks throw loudly. */
function makeDispatcher(contextValue: unknown): Record<string, unknown> {
  return {
    useContext: () => contextValue,
    useState: (init: unknown) => [typeof init === `function` ? (init as () => unknown)() : init, () => undefined],
    useReducer: (_r: unknown, init: unknown) => [init, () => undefined],
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

export async function runCase(corpusDir: string, c: CaseFile, log: (line: string) => void): Promise<RunResult> {
  const chunksDir = join(corpusDir, `pretty`, `client`);
  const closure: Closure = buildSandbox(chunksDir, c.chunk, c.stubs ?? {});
  try {
    return await runInSandbox(corpusDir, closure, c, log);
  } finally {
    rmSync(closure.dir, { recursive: true, force: true });
  }
}

async function runInSandbox(corpusDir: string, closure: Closure, c: CaseFile, log: (line: string) => void): Promise<RunResult> {
  log(`sandbox: ${closure.chunks.length} chunks (${closure.stubbed.length} stubbed) at ${closure.dir}`);
  for (const name of closure.chunks) {
    log(`  ${closure.stubbed.includes(name) ? `[stub] ` : ``}${name}`);
  }

  const entryUrl = pathToFileURL(join(closure.dir, c.chunk)).href;
  const mod = (await import(entryUrl)) as Record<string, unknown>;

  let output: unknown;
  if (c.invoke !== undefined) {
    // "export" takes a dotted path for object exports, e.g. "t.generateTheme".
    const path = c.invoke.export.split(`.`);
    let fn: unknown = mod;
    for (const seg of path) fn = (fn as Record<string, unknown> | undefined)?.[seg];
    if (typeof fn !== `function`) {
      throw new Error(`export "${c.invoke.export}" of ${c.chunk} is ${typeof fn}, not a function (exports: ${Object.keys(mod).join(`, `)})`);
    }
    output = (fn as (...a: unknown[]) => unknown)(...(c.invoke.args ?? []));
  } else {
    const r = c.render as NonNullable<CaseFile[`render`]>;
    const component = mod[r.export];
    if (typeof component !== `function`) {
      throw new Error(`export "${r.export}" of ${c.chunk} is ${typeof component}, not a function component`);
    }
    const reactChunk = r.reactChunk ?? closure.chunks.find((n) => /^react\./.test(n));
    if (reactChunk === undefined) {
      throw new Error(`render mode: no react chunk in the closure and none declared (render.reactChunk)`);
    }
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

  return {
    provenance: {
      tool: `corpus-exec/g1`,
      corpusHead: gitHead(corpusDir),
      entry: c.chunk,
      closureSize: closure.chunks.length,
      stubbed: closure.stubbed,
      chunkHashes: closure.hashes,
    },
    output,
  };
}

/** The bytes written to <case>.expected.json. */
export function expectedBytes(result: RunResult): string {
  return stringify({ provenance: result.provenance, output: result.output });
}
