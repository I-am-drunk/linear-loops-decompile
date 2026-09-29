/**
 * remap-graph core (#295 assembly-track sizing; #225 claim 2026-09-29T00:53Z):
 *
 * Reads the RAW corpus chunk tree (`pipeline/corpus/client/`) and computes,
 * for a declared root set (tools/remap-graph/roots.json):
 *
 *   - the import graph: static `from"./x"`, side-effect `import"./x"`, and
 *     dynamic `import("./x")` edges (the raw tree is single-line minified
 *     rolldown output, so string-level extraction is exact for these forms —
 *     verified against the 1.32.4 tree: every specifier is `./`-relative and
 *     double-quoted);
 *   - the full transitive closure of the roots (chunks + bytes);
 *   - the closure EXCLUDING declared "monster" chunks (the assembly set);
 *   - a vendor/app split by the declared vendor rule (lowercase first char —
 *     rolldown names app chunks after their PascalCase entry module);
 *   - per-chunk fan-in WITHIN the assembly set (build-order signal);
 *   - per-monster demanded-export lists: the distinct original export names
 *     the assembly set imports from each monster, with importer counts.
 *
 * Everything emitted is extracted FACT (chunk file names, byte counts, edge
 * relations, minified symbol names) — the same class extracts/graphql-ops.md
 * already commits. No chunk source text is ever emitted.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type RootsConfig = {
  /** why this root set = the widened #295 scope; free text, required */
  rationale: string;
  /** chunk file names (exact, with hash) treated as route roots */
  roots: string[];
  /** chunk file names excluded from the assembly closure and analyzed for
   * demanded exports instead (facade candidates) */
  monsters: string[];
  /** fan-in table size in the human report */
  fanInTop: number;
};

export type ChunkGraph = {
  /** chunk -> imported chunk names (only edges to files present in the tree) */
  edges: Map<string, Set<string>>;
  /** chunk -> size in bytes */
  sizes: Map<string, number>;
  /** chunk -> raw source (kept for demand extraction; not emitted) */
  sources: Map<string, string>;
};

export type MonsterDemand = {
  monster: string;
  totalExports: number;
  demanded: string[]; // sorted original (pre-`as`) export names
  importers: string[]; // sorted assembly-set chunks importing the monster
};

export type Analysis = {
  corpusHead: string;
  fanInTop: number;
  chunkCount: number;
  totalBytes: number;
  roots: string[];
  missingRoots: string[];
  fullClosure: { chunks: number; bytes: number };
  monsters: { name: string; bytes: number }[];
  monsterOnly: { chunks: number; bytes: number };
  assembly: { chunks: number; bytes: number; files: string[] };
  vendor: { chunks: number; bytes: number };
  app: { chunks: number; bytes: number };
  histogram: { under12k: number; from12to64k: number; over64k: number };
  fanIn: { chunk: string; importers: number; bytes: number; vendor: boolean }[];
  demands: MonsterDemand[];
};

const IMPORT_RE = /(?:from|import)\s*\(?\s*"\.\/([^"]+)"/g;

export function extractImports(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(IMPORT_RE)) out.add(m[1] as string);
  return out;
}

export function loadGraph(clientDir: string): ChunkGraph {
  const edges = new Map<string, Set<string>>();
  const sizes = new Map<string, number>();
  const sources = new Map<string, string>();
  const files = readdirSync(clientDir).filter((f) => f.endsWith(`.js`)).sort();
  if (files.length === 0) throw new Error(`no .js chunks in ${clientDir}`);
  for (const f of files) {
    const src = readFileSync(join(clientDir, f), `utf8`);
    sizes.set(f, Buffer.byteLength(src));
    sources.set(f, src);
  }
  for (const f of files) {
    const deps = new Set<string>();
    for (const d of extractImports(sources.get(f) as string)) if (sizes.has(d)) deps.add(d);
    edges.set(f, deps);
  }
  return { edges, sizes, sources };
}

export function closure(graph: ChunkGraph, roots: string[], block: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const stack = roots.filter((r) => graph.edges.has(r) && !block.has(r));
  while (stack.length > 0) {
    const f = stack.pop() as string;
    if (seen.has(f)) continue;
    seen.add(f);
    for (const d of graph.edges.get(f) ?? []) if (!seen.has(d) && !block.has(d)) stack.push(d);
  }
  return seen;
}

export function isVendorName(chunk: string): boolean {
  const c = chunk.charAt(0);
  return c === c.toLowerCase();
}

function sumBytes(graph: ChunkGraph, files: Iterable<string>): number {
  let n = 0;
  for (const f of files) n += graph.sizes.get(f) ?? 0;
  return n;
}

/** Distinct ORIGINAL export names (left of `as`) that `importers` pull from
 * `monster`, via `import{...}from"./monster"` clauses. */
export function demandedExports(graph: ChunkGraph, monster: string, importers: Iterable<string>): MonsterDemand {
  const demanded = new Set<string>();
  const who: string[] = [];
  const esc = monster.replace(/[.*+?^${}()|[\]\\]/g, `\\$&`);
  const clause = new RegExp(`import\\{([^}]*)\\}from"\\./${esc}"`, `g`);
  for (const f of importers) {
    const src = graph.sources.get(f) ?? ``;
    let hit = false;
    for (const m of src.matchAll(clause)) {
      hit = true;
      for (const spec of (m[1] as string).split(`,`)) {
        const orig = (spec.split(` as `)[0] ?? ``).trim();
        if (orig !== ``) demanded.add(orig);
      }
    }
    if (hit) who.push(f);
  }
  // total export surface of the monster: count specs inside export{...} clauses
  let total = 0;
  const src = graph.sources.get(monster) ?? ``;
  for (const m of src.matchAll(/export\{([^}]*)\}/g)) total += (m[1] as string).split(`,`).filter((s) => s.trim() !== ``).length;
  return { monster, totalExports: total, demanded: [...demanded].sort(), importers: who.sort() };
}

export function analyze(graph: ChunkGraph, config: RootsConfig, corpusHead: string): Analysis {
  const present = config.roots.filter((r) => graph.edges.has(r));
  const missing = config.roots.filter((r) => !graph.edges.has(r));
  const monsterSet = new Set(config.monsters.filter((m) => graph.edges.has(m)));
  const full = closure(graph, present, new Set());
  const assemblySet = closure(graph, present, monsterSet);
  const monsterOnlyFiles = [...full].filter((f) => !assemblySet.has(f) && !monsterSet.has(f));
  const assemblyFiles = [...assemblySet].sort();
  const vendorFiles = assemblyFiles.filter(isVendorName);
  const appFiles = assemblyFiles.filter((f) => !isVendorName(f));
  const fanCount = new Map<string, number>();
  for (const f of assemblySet) {
    for (const d of graph.edges.get(f) ?? []) {
      if (assemblySet.has(d)) fanCount.set(d, (fanCount.get(d) ?? 0) + 1);
    }
  }
  const fanIn = [...fanCount.entries()]
    .map(([chunk, importers]) => ({ chunk, importers, bytes: graph.sizes.get(chunk) ?? 0, vendor: isVendorName(chunk) }))
    .sort((a, b) => b.importers - a.importers || a.chunk.localeCompare(b.chunk));
  let under12k = 0;
  let from12to64k = 0;
  let over64k = 0;
  for (const f of assemblyFiles) {
    const s = graph.sizes.get(f) ?? 0;
    if (s < 12_000) under12k++;
    else if (s < 64_000) from12to64k++;
    else over64k++;
  }
  return {
    corpusHead,
    fanInTop: config.fanInTop,
    chunkCount: graph.sizes.size,
    totalBytes: sumBytes(graph, graph.sizes.keys()),
    roots: present,
    missingRoots: missing,
    fullClosure: { chunks: full.size, bytes: sumBytes(graph, full) },
    monsters: [...monsterSet].sort().map((name) => ({ name, bytes: graph.sizes.get(name) ?? 0 })),
    monsterOnly: { chunks: monsterOnlyFiles.length, bytes: sumBytes(graph, monsterOnlyFiles) },
    assembly: { chunks: assemblyFiles.length, bytes: sumBytes(graph, assemblyFiles), files: assemblyFiles },
    vendor: { chunks: vendorFiles.length, bytes: sumBytes(graph, vendorFiles) },
    app: { chunks: appFiles.length, bytes: sumBytes(graph, appFiles) },
    histogram: { under12k, from12to64k, over64k },
    fanIn,
    demands: [...monsterSet].sort().map((m) => demandedExports(graph, m, assemblySet)),
  };
}
