/**
 * Case execution: load the case file, build the sandbox, execute the entry
 * chunk in `invoke` (plain function) or `render` (React function component
 * under a micro-dispatcher on the CORPUS's own React) mode, and return the
 * deterministically-serialized output plus provenance.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSandbox, type Closure, type Stub } from "./sandbox.ts";
import { SERIALIZER_VERSION, serialize, stringify } from "./serialize.ts";

export type CaseFile = {
  unit: string;
  /** Chunk reference: a full basename or a prefix up to the first dot
   * (`ThemeHelper`); prefixes survive hash rotation across corpus refreshes
   * (#225 red-team R2-1). The resolved full name lands in provenance. */
  chunk: string;
  stubs?: Record<string, Stub>;
  invoke?: { export: string; exportMeaning: string; args?: unknown[] };
  /** Escape hatch for setups JSON args cannot express (multi-step calls,
   * memoization checks — #225 red-team R2-2): a sibling hand-written ESM
   * driver whose default export is `async (sandbox: { load(chunkRef) }) =>
   * value-to-serialize`. Reviewed like a stub; the runner stays dumb. */
  drive?: { file: string; exportMeaning: string };
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

export type CorpusSource = {
  /** Captured raw bytes are the execution authority; pretty is legacy/recon only. */
  flavor: `raw` | `pretty`;
  /** Stable path relative to corpus root, never a machine-specific absolute path. */
  path: `client` | `pretty/client`;
  chunksDir: string;
};

export type RunResult = {
  provenance: {
    tool: string;
    serializer: string;
    corpusHead: string | null;
    corpusSource: { flavor: `raw` | `pretty`; path: `client` | `pretty/client` };
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
  const modes = [c.invoke, c.render, c.drive].filter((m) => m !== undefined).length;
  if (modes !== 1) throw new Error(`case file needs exactly one of "invoke" | "render" | "drive": ${path}`);
  if (c.drive !== undefined) {
    if (typeof c.drive.file !== `string` || typeof c.drive.exportMeaning !== `string`) {
      throw new Error(`drive mode needs "file" and "exportMeaning": ${path}`);
    }
  } else {
    const mode = c.invoke ?? c.render;
    if (typeof mode?.export !== `string` || typeof mode?.exportMeaning !== `string`) {
      throw new Error(`the mode needs "export" and "exportMeaning" (identify the minified export with corpus evidence): ${path}`);
    }
  }
  for (const [name, stub] of Object.entries(c.stubs ?? {})) {
    const forms = [typeof stub.source === `string`, typeof stub.file === `string`].filter(Boolean).length;
    if (forms !== 1 || typeof stub.why !== `string`) {
      throw new Error(`stub "${name}" needs exactly one of "source" | "file", plus "why": ${path}`);
    }
  }
  return c;
}

/**
 * The corpus provenance head (issue #250). Resolution ladder:
 *   1. `<corpusDir>/.corpus-head` stamp file (one hex line, written by the
 *      pipeline/README.md fetch recipe) — the vault commit the bytes came from.
 *   2. `git rev-parse HEAD` ONLY when the corpus dir is a real corpus
 *      checkout: its own git toplevel, or `<toplevel>/corpus` (the vault
 *      layout, PR #251's rung). A copied tree without `.git` must never
 *      resolve the CONTAINING repo's HEAD: that recorded the decompile repo's
 *      commit and made `verify` fail on byte-perfect goldens for every
 *      reviewer on a different repo commit.
 *   3. null — honest "unknown"; verify treats it as informational.
 */
export function corpusHead(dir: string): string | null {
  const stamp = join(dir, `.corpus-head`);
  if (existsSync(stamp)) {
    const line = readFileSync(stamp, `utf8`).trim();
    if (/^[0-9a-f]{7,64}$/i.test(line)) return line;
    throw new Error(`corpus .corpus-head stamp is not a commit hash: ${stamp} (got ${JSON.stringify(line.slice(0, 40))})`);
  }
  try {
    const toplevel = realpathSync(execFileSync(`git`, [`-C`, dir, `rev-parse`, `--show-toplevel`], { encoding: `utf8`, stdio: [`ignore`, `pipe`, `ignore`] }).trim());
    const real = realpathSync(dir);
    if (real !== toplevel && real !== join(toplevel, `corpus`)) return null;
    return execFileSync(`git`, [`-C`, dir, `rev-parse`, `HEAD`], { encoding: `utf8`, stdio: [`ignore`, `pipe`, `ignore`] }).trim();
  } catch {
    return null;
  }
}

/**
 * Select the executable corpus representation. `client/` is captured raw ESM
 * and therefore authoritative. `pretty/client/` is retained only for legacy
 * corpora and human/recon work; never prefer it when raw bytes are present.
 */
export function selectCorpusSource(corpusDir: string): CorpusSource {
  const raw = join(corpusDir, `client`);
  if (existsSync(raw)) return { flavor: `raw`, path: `client`, chunksDir: raw };
  const pretty = join(corpusDir, `pretty`, `client`);
  if (existsSync(pretty)) return { flavor: `pretty`, path: `pretty/client`, chunksDir: pretty };
  throw new Error(`corpus has neither client/ (raw) nor pretty/client/ (legacy): ${corpusDir}`);
}

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

/** `caseDir` anchors relative stub/driver file paths (the case file's dir). */
export async function runCase(corpusDir: string, caseDir: string, c: CaseFile, log: (line: string) => void): Promise<RunResult> {
  const source = selectCorpusSource(corpusDir);
  const closure: Closure = buildSandbox(source.chunksDir, caseDir, c.chunk, c.stubs ?? {});
  try {
    return await runInSandbox(corpusDir, caseDir, source, closure, c, log);
  } finally {
    rmSync(closure.dir, { recursive: true, force: true });
  }
}

async function runInSandbox(corpusDir: string, caseDir: string, source: CorpusSource, closure: Closure, c: CaseFile, log: (line: string) => void): Promise<RunResult> {
  log(`sandbox: ${source.flavor} ${source.path}, ${closure.chunks.length} chunks (${closure.stubbed.length} stubbed) at ${closure.dir}`);
  for (const name of closure.chunks) {
    log(`  ${closure.stubbed.includes(name) ? `[stub] ` : ``}${name}`);
  }

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
      serializer: SERIALIZER_VERSION,
      corpusHead: corpusHead(corpusDir),
      corpusSource: { flavor: source.flavor, path: source.path },
      entry: closure.entry, // resolved full name (case may declare a prefix)
      closureSize: closure.chunks.length,
      stubbed: closure.stubbed,
      chunkHashes: closure.hashes,
    },
    output,
  };
}

/**
 * The bytes written to <case>.expected.json. Provenance is ordinary metadata;
 * only the observed output uses the closed tagged grammar. Keeping this
 * envelope untagged lets verify inspect its fields when reporting a mismatch.
 */
export function expectedBytes(result: RunResult): string {
  return `${JSON.stringify({ provenance: result.provenance, output: serialize(result.output) }, null, 2)}\n`;
}
