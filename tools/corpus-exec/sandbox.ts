/**
 * Sandbox builder: compute a corpus chunk's transitive import closure,
 * copy it into a scratch dir with declared stubs substituted, and report
 * the closure so the author can judge feasibility BEFORE anything runs.
 *
 * The corpus chunks are native ESM with relative `./x.js` specifiers, so a
 * plain dynamic import of the sandbox entry executes them — no bundler, no
 * loader hooks (proven on ThemeHelper, issue #225 R2 finding).
 */

import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export type Stub = { source: string; why: string };

export type Closure = {
  /** entry chunk basename */
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

const IMPORT_RE = /from\s*"\.\/([^"]+)"/g;

function importsOf(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(IMPORT_RE)) out.push(m[1]);
  return out;
}

/**
 * Build the sandbox. `chunksDir` is the corpus `pretty/client` directory.
 * Throws (Error with a named chunk) on a missing chunk — a partial corpus
 * must fail loudly, never produce a partial sandbox (#205 doctrine).
 */
export function buildSandbox(chunksDir: string, entry: string, stubs: Record<string, Stub>): Closure {
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
    const stub = stubs[name];
    if (stub !== undefined) {
      stubbed.push(name);
      writeFileSync(join(dir, name), stub.source);
      // stubs may import other chunks too (rare but legal)
      stack.push(...importsOf(stub.source));
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
export function closureSize(chunksDir: string, entry: string, stubs: Record<string, Stub>): number {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const name = stack.pop() as string;
    if (seen.has(name)) continue;
    seen.add(name);
    if (stubs[name] !== undefined) continue;
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
