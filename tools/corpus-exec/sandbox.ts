/**
 * Sandbox builder: compute a corpus chunk's transitive import closure,
 * copy it into a scratch dir with declared stubs substituted, and report
 * the closure so the author can judge feasibility BEFORE anything runs.
 *
 * The corpus chunks are native ESM with relative `./x.js` specifiers, so a
 * plain dynamic import of the sandbox entry executes them — no bundler, no
 * loader hooks (proven on ThemeHelper, issue #225 R2 finding).
 *
 * Chunk names are content-hashed and churn per release
 * (`LoopsManagementPage.{BAhf8Ti3,CVnaEF7c}.js` — #225 red-team R2-1), so
 * case files refer to chunks by BASENAME PREFIX (`ThemeHelper` or a full
 * name). Resolution happens against the live corpus; the resolved full name
 * lands in provenance, and ambiguity is a loud error, never a silent pick.
 */

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A stub is inline `source` (tiny one-liners) or a sibling `file` of real,
 * reviewable ESM (#225 red-team R2-3); exactly one, plus the mandatory why. */
export type Stub = { source?: string; file?: string; why: string };

export type Closure = {
  /** entry chunk: resolved full basename */
  entry: string;
  /** every chunk in the sandbox (entry, deps, stubs), sorted */
  chunks: string[];
  /** subset of `chunks` that were replaced by stubs */
  stubbed: string[];
  /** sha256 per non-stubbed chunk basename */
  hashes: Record<string, string>;
  /** absolute path of the sandbox dir */
  dir: string;
};

// `from "./x"` (static), `import "./x"` (side-effect), `import("./x")` (dynamic).
const IMPORT_RE = /(?:from\s*|import\s*\(?\s*)"\.\/([^"]+)"/g;

function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

/**
 * Resolve a chunk reference (full name, or basename prefix up to the first
 * dot) against the corpus dir. Ambiguity and absence both throw, naming the
 * candidates — resolution is never a silent pick.
 */
export function resolveChunk(chunksDir: string, ref: string): string {
  const names = readdirSync(chunksDir);
  if (names.includes(ref)) return ref;
  const matches = names.filter((n) => n.startsWith(`${ref}.`)).sort();
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) {
    throw new Error(`chunk not found in corpus: ${ref} (partial corpus? full-clone the vault — pipeline/README.md)`);
  }
  throw new Error(`chunk reference "${ref}" is ambiguous in this corpus: ${matches.join(`, `)} — pin the full name in the case file and record why (hash-rotated duplicate builds)`);
}

/** Resolve a stub key the same way, against the union of corpus names and
 * already-seen names (a stub may target a chunk the corpus lacks entirely). */
function resolveStubKeys(chunksDir: string, stubs: Record<string, Stub>): Map<string, Stub> {
  const out = new Map<string, Stub>();
  for (const [ref, stub] of Object.entries(stubs)) {
    let resolved = ref;
    try {
      resolved = resolveChunk(chunksDir, ref);
    } catch (e) {
      // The literal-ref fallback exists ONLY for a genuinely absent chunk (a
      // stub may shadow a chunk the corpus lacks). An AMBIGUOUS ref must
      // propagate: swallowing it kept the unresolved prefix as the key, no
      // chunk matched it, and the declared substitution vanished silently —
      // the case then ran an UNSTUBBED world it did not declare (#230 review).
      if (e instanceof Error && e.message.includes(`ambiguous`)) throw e;
    }
    out.set(resolved, stub);
  }
  return out;
}

function stubSource(caseDir: string, name: string, stub: Stub): string {
  const has = [stub.source !== undefined, stub.file !== undefined].filter(Boolean).length;
  if (has !== 1) throw new Error(`stub "${name}" needs exactly one of "source" (inline one-liner) or "file" (sibling ESM)`);
  if (stub.source !== undefined) return stub.source;
  return readFileSync(join(caseDir, stub.file as string), `utf8`);
}

/**
 * Build the sandbox. `chunksDir` is the corpus `pretty/client` directory;
 * `caseDir` anchors relative stub `file` paths. Throws (naming the chunk) on
 * a missing chunk — a partial corpus must fail loudly, never produce a
 * partial sandbox (#205 doctrine).
 */
export function buildSandbox(chunksDir: string, caseDir: string, entryRef: string, stubs: Record<string, Stub>): Closure {
  const entry = resolveChunk(chunksDir, entryRef);
  const stubMap = resolveStubKeys(chunksDir, stubs);
  const dir = mkdtempSync(join(tmpdir(), `corpus-exec-`));
  mkdirSync(dir, { recursive: true });
  const seen = new Set<string>();
  const hashes: Record<string, string> = {};
  const stubbed: string[] = [];
  const stack = [entry];
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    const stub = stubMap.get(name);
    if (stub !== undefined) {
      stubbed.push(name);
      const source = stubSource(caseDir, name, stub);
      writeFileSync(join(dir, name), source);
      // stubs may import other chunks too (rare but legal)
      stack.push(...importsOf(source));
      continue;
    }
    const src = join(chunksDir, name);
    let text: string;
    try {
      text = readFileSync(src, `utf8`);
    } catch {
      throw new Error(`chunk not found in corpus: ${name} (partial corpus? full-clone the vault — pipeline/README.md)`);
    }
    hashes[name] = createHash(`sha256`).update(text).digest(`hex`);
    copyFileSync(src, join(dir, name));
    stack.push(...importsOf(text));
  }
  const chunks = [...seen].sort();
  stubbed.sort();
  return { entry, chunks, stubbed, hashes, dir };
}

/** Closure size WITHOUT building anything — the feasibility probe. */
export function closureSize(chunksDir: string, entryRef: string, stubs: Record<string, Stub>): number {
  let entry: string;
  try {
    entry = resolveChunk(chunksDir, entryRef);
  } catch {
    return 0;
  }
  const stubNames = new Set(resolveStubKeys(chunksDir, stubs).keys());
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    if (stubNames.has(name)) continue;
    let text: string;
    try {
      text = readFileSync(join(chunksDir, name), `utf8`);
    } catch {
      continue; // missing chunks are counted; buildSandbox is the loud gate
    }
    stack.push(...importsOf(text));
  }
  return seen.size;
}
