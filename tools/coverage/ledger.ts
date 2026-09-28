/**
 * coverage ledger (G2; SPECS/ui-parity.md "golden tier" item 4):
 *
 * Joins three COMMITTED inputs — no corpus needed, so this leg can never be
 * vacuous (#225 D3):
 *
 *   1. docs/feature-matrix.md      — the surface inventory (backticked
 *      `Component.HASH.js` evidence names, same grammar tools/parity extract
 *      reads; brace-sets `A.{H1,H2}.js` and bare prefixes count too).
 *   2. src/<pkg>/corpus-manifest.json — what a clean package DECLARES it
 *      reimplements (chunk prefixes + minified-export meanings + golden case
 *      ids + declared improvements). The manifest is the durable home for
 *      the hand-verification evidence that used to live in PR prose (#225 R3).
 *   3. src/<pkg>/golden/*.json     — the committed golden manifests the
 *      declared case ids must resolve to (a dangling id is a loud error, so
 *      "golden-backed" can never be asserted without the golden actually
 *      committed).
 *
 * Output: per matrix-§ surface, every evidence chunk classified
 *   golden | improvement | GAP
 * GAP is the honest default. Chunk-level coverage overstates (one export of
 * a 40-export chunk), so where a manifest declares per-export meanings the
 * ledger prints export denominators beside the chunk line (#225 R3 caveat).
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

export type ManifestExport = { minified: string; meaning: string; evidenceLine?: string };
export type ManifestEntry = {
  chunkPrefix: string;
  exports?: ManifestExport[];
  /** golden case ids backing THIS chunk. When absent, the package-level
   * goldens list is the claim for every entry (fine for a single-substrate
   * package like ui-theme where every golden executes all three chunks);
   * a multi-chunk package with per-chunk cases should scope them here so one
   * chunk's golden can never back another (#237 review). */
  goldens?: string[];
};
export type CorpusManifest = {
  /** package-relative provenance note; free text but required (why/where) */
  source: string;
  reimplements: ManifestEntry[];
  /** golden case ids: file basenames (without .json) under <pkg>/golden/ */
  goldens: string[];
  /** declared deviations: each names the chunk it covers explicitly plus a
   * ref into tools/parity/policy/improvements.json or an issue URL — a bare
   * URL carries no chunk identity, so the join needs the prefix (#237 review). */
  improvements?: { chunkPrefix: string; ref: string }[];
};

export type ChunkClass = `golden` | `improvement` | `GAP`;
export type ChunkRow = {
  surface: string;
  section: string;
  chunk: string;
  cls: ChunkClass;
  /** which package's manifest claimed it (for golden/improvement) */
  pkg?: string;
  exportsCovered?: number;
};
export type Ledger = {
  rows: ChunkRow[];
  surfaces: number;
  chunks: number;
  golden: number;
  improvement: number;
  gap: number;
  packages: string[];
  /** manifest-declared chunk prefixes that join NO matrix evidence chunk —
   * loud, so a manifest can never quietly claim coverage the denominator
   * does not measure (the ThemeHelper case: reimplemented + golden-backed,
   * but the matrix names it only as behavior, not as chunk evidence). */
  offMatrix: { pkg: string; chunkPrefix: string; goldenBacked: boolean }[];
  errors: string[];
};

/** Matrix evidence grammar (mirrors tools/parity extract): backticked names.
 * Accepts `Name.HASH.js`, `Name.{H1,H2}.js`, and bare `Name` / `Name.*`
 * component references; route/op/model evidence (contains `/` or a space or
 * starts lowercase-with-space) is not a chunk. */
export function chunkRefsFromMatrix(md: string): { section: string; surface: string; chunks: string[] }[] {
  const out: { section: string; surface: string; chunks: string[] }[] = [];
  let section = ``;
  for (const line of md.split(`\n`)) {
    const h = line.match(/^## ([A-Z])\. (.*)$/);
    if (h !== null) {
      section = `${h[1]}. ${h[2]}`;
      continue;
    }
    if (!line.startsWith(`|`) || section === ``) continue;
    const cells = line.split(`|`).map((c) => c.trim());
    if (cells.length < 4 || cells[1] === `Feature` || cells[1].startsWith(`---`) || cells[1] === ``) continue;
    const surface = cells[1].replace(/`/g, ``);
    const evidence = cells[2] ?? ``;
    const chunks: string[] = [];
    for (const m of evidence.matchAll(/`([A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_{},*-]+)*\.js|[A-Za-z][A-Za-z0-9]*(?:\.\*|\*)?)`/g)) {
      const ref = m[1];
      // brace expansion: A.{H1,H2}.js → A.H1.js, A.H2.js
      const brace = ref.match(/^([A-Za-z0-9]+)\.\{([^}]+)\}\.js$/);
      if (brace !== null) {
        for (const h2 of brace[2].split(`,`)) chunks.push(`${brace[1]}.${h2.trim()}.js`);
        continue;
      }
      // bare lowercase refs are op fields/keywords, EXCEPT use* hooks — hooks
      // are real chunks (`useTrackRecentLoop.DJGSsw3v.js` etc).
      if (/^[a-z]/.test(ref) && !ref.endsWith(`.js`) && !/^use[A-Z]/.test(ref)) continue;
      chunks.push(ref.replace(/\.\*$/, ``).replace(/\*$/, ``));
    }
    if (chunks.length > 0) out.push({ section, surface, chunks });
  }
  return out;
}

/** A matrix evidence ref covers a manifest chunkPrefix (or vice versa) when
 * either is a prefix of the other at a dot boundary. `LoopsManagementPage`
 * covers `LoopsManagementPage.BAhf8Ti3.js`; never substring matches. */
export function refCovers(manifestPrefix: string, matrixRef: string): boolean {
  const a = manifestPrefix.replace(/\.js$/, ``);
  const b = matrixRef.replace(/\.js$/, ``);
  return a === b || b.startsWith(`${a}.`) || a.startsWith(`${b}.`);
}

export function loadManifests(srcDir: string): { pkg: string; manifest: CorpusManifest; goldenFiles: string[]; errors: string[] }[] {
  const out: { pkg: string; manifest: CorpusManifest; goldenFiles: string[]; errors: string[] }[] = [];
  if (!existsSync(srcDir)) return out;
  for (const pkg of readdirSync(srcDir, { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue;
    const mPath = join(srcDir, pkg.name, `corpus-manifest.json`);
    if (!existsSync(mPath)) continue;
    const errors: string[] = [];
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(mPath, `utf8`));
    } catch (e) {
      out.push({ pkg: pkg.name, manifest: { source: ``, reimplements: [], goldens: [] }, goldenFiles: [], errors: [`${mPath}: invalid JSON — ${e instanceof Error ? e.message : String(e)}`] });
      continue;
    }
    // Validate + NORMALIZE before the ledger ever touches it: a malformed
    // manifest is a consistency error (exit 1), never a tooling crash
    // (exit 2) (#237 review).
    if (raw === null || typeof raw !== `object` || Array.isArray(raw)) {
      out.push({ pkg: pkg.name, manifest: { source: ``, reimplements: [], goldens: [] }, goldenFiles: [], errors: [`${mPath}: manifest root must be an object`] });
      continue;
    }
    const r = raw as Record<string, unknown>;
    if (typeof r.source !== `string` || r.source === ``) errors.push(`${mPath}: missing "source" provenance`);
    if (!Array.isArray(r.reimplements)) errors.push(`${mPath}: "reimplements" must be an array`);
    if (!Array.isArray(r.goldens)) errors.push(`${mPath}: "goldens" must be an array`);
    if (r.improvements !== undefined && !Array.isArray(r.improvements)) errors.push(`${mPath}: "improvements" must be an array`);
    const reimplements: ManifestEntry[] = [];
    for (const entry of Array.isArray(r.reimplements) ? r.reimplements : []) {
      if (entry === null || typeof entry !== `object` || typeof (entry as ManifestEntry).chunkPrefix !== `string` || (entry as ManifestEntry).chunkPrefix === ``) {
        errors.push(`${mPath}: reimplements entry missing chunkPrefix`);
        continue;
      }
      const e = entry as ManifestEntry;
      if (e.goldens !== undefined && !Array.isArray(e.goldens)) {
        errors.push(`${mPath}: reimplements["${e.chunkPrefix}"].goldens must be an array`);
        continue;
      }
      reimplements.push(e);
    }
    const improvements: { chunkPrefix: string; ref: string }[] = [];
    for (const imp of Array.isArray(r.improvements) ? r.improvements : []) {
      if (imp === null || typeof imp !== `object` || typeof (imp as { chunkPrefix?: unknown }).chunkPrefix !== `string` || typeof (imp as { ref?: unknown }).ref !== `string`) {
        errors.push(`${mPath}: improvements entries must be { chunkPrefix, ref } objects (a bare URL carries no chunk identity)`);
        continue;
      }
      improvements.push(imp as { chunkPrefix: string; ref: string });
    }
    const goldens = (Array.isArray(r.goldens) ? r.goldens : []).filter((g): g is string => typeof g === `string`);
    const manifest: CorpusManifest = { source: typeof r.source === `string` ? r.source : ``, reimplements, goldens, improvements };
    const goldenDir = join(srcDir, pkg.name, `golden`);
    const goldenFiles = existsSync(goldenDir) ? readdirSync(goldenDir).filter((f) => f.endsWith(`.json`)) : [];
    const allDeclaredIds = [...goldens, ...reimplements.flatMap((e) => e.goldens ?? [])];
    for (const id of allDeclaredIds) {
      if (!goldenFiles.includes(`${id}.json`)) {
        errors.push(`${mPath}: golden case id "${id}" has no committed file ${id}.json under ${pkg.name}/golden/ — a dangling id cannot back a coverage claim`);
      }
    }
    out.push({ pkg: pkg.name, manifest, goldenFiles, errors });
  }
  return out;
}

export function buildLedger(repoRoot: string): Ledger {
  const md = readFileSync(join(repoRoot, `docs`, `feature-matrix.md`), `utf8`);
  const surfaces = chunkRefsFromMatrix(md);
  const manifests = loadManifests(join(repoRoot, `src`));
  const errors = manifests.flatMap((m) => m.errors);
  const rows: ChunkRow[] = [];
  for (const s of surfaces) {
    for (const chunk of s.chunks) {
      let cls: ChunkClass = `GAP`;
      let pkg: string | undefined;
      let exportsCovered: number | undefined;
      // Two passes over ALL manifests (#237 review: never let iteration order
      // or an early improvement `break` shadow a golden-backed claim):
      // 1) reimplementation claims — golden wins as soon as any package backs
      //    the chunk with a resolvable case;
      // 2) improvement claims — only for chunks no reimplementation covers.
      for (const m of manifests) {
        const hit = m.manifest.reimplements.find((r) => refCovers(r.chunkPrefix, chunk));
        if (hit === undefined) continue;
        // The cases backing THIS chunk: per-entry goldens when scoped, else
        // the package list. All ids were resolution-checked in loadManifests;
        // any dangling id in the relevant set voids the claim.
        const caseIds = hit.goldens ?? m.manifest.goldens;
        const backed = caseIds.length > 0 && caseIds.every((id) => m.goldenFiles.includes(`${id}.json`));
        if (backed) {
          cls = `golden`;
          pkg = m.pkg;
          exportsCovered = hit.exports?.length;
          break;
        }
        errors.push(`src/${m.pkg}: declares ${chunk} but commits no resolvable golden — stays GAP (never a silent claim)`);
      }
      if (cls === `GAP`) {
        for (const m of manifests) {
          if ((m.manifest.improvements ?? []).some((imp) => refCovers(imp.chunkPrefix, chunk))) {
            cls = `improvement`;
            pkg = m.pkg;
            break;
          }
        }
      }
      rows.push({ surface: s.surface.slice(0, 60), section: s.section, chunk, cls, pkg, exportsCovered });
    }
  }
  const allMatrixChunks = surfaces.flatMap((s) => s.chunks);
  const offMatrix: { pkg: string; chunkPrefix: string; goldenBacked: boolean }[] = [];
  for (const m of manifests) {
    for (const r of Array.isArray(m.manifest.reimplements) ? m.manifest.reimplements : []) {
      if (typeof r.chunkPrefix !== `string` || r.chunkPrefix === ``) continue;
      if (!allMatrixChunks.some((c) => refCovers(r.chunkPrefix, c))) {
        const caseIds = r.goldens ?? m.manifest.goldens;
        const goldenBacked = caseIds.length > 0 && caseIds.every((id) => m.goldenFiles.includes(`${id}.json`));
        offMatrix.push({ pkg: m.pkg, chunkPrefix: r.chunkPrefix, goldenBacked });
      }
    }
  }
  return {
    rows,
    surfaces: surfaces.length,
    chunks: rows.length,
    golden: rows.filter((r) => r.cls === `golden`).length,
    improvement: rows.filter((r) => r.cls === `improvement`).length,
    gap: rows.filter((r) => r.cls === `GAP`).length,
    packages: manifests.map((m) => m.pkg),
    offMatrix,
    errors,
  };
}

export function renderReport(l: Ledger): string {
  const lines: string[] = [];
  lines.push(`# coverage ledger (G2 — SPECS/ui-parity.md golden tier item 4)`);
  lines.push(``);
  lines.push(`Committed-inputs only (matrix × corpus-manifests × goldens); corpus-free by design.`);
  lines.push(``);
  lines.push(`**${l.surfaces} surfaces · ${l.chunks} evidence chunks: ${l.golden} golden · ${l.improvement} improvement · ${l.gap} GAP**`);
  lines.push(``);
  let section = ``;
  for (const r of l.rows) {
    if (r.section !== section) {
      section = r.section;
      lines.push(`## ${section}`);
      lines.push(``);
      lines.push(`| chunk | surface | class | via |`);
      lines.push(`|---|---|---|---|`);
    }
    const via = r.pkg !== undefined ? `src/${r.pkg}${r.exportsCovered !== undefined ? ` (${r.exportsCovered} exports declared)` : ``}` : ``;
    lines.push(`| \`${r.chunk}\` | ${r.surface} | ${r.cls === `GAP` ? `**GAP**` : r.cls} | ${via} |`);
  }
  if (l.offMatrix.length > 0) {
    lines.push(``);
    lines.push(`## reimplemented off-matrix (real work the denominator does not yet measure)`);
    lines.push(``);
    lines.push(`| package | chunkPrefix | golden-backed |`);
    lines.push(`|---|---|---|`);
    for (const o of l.offMatrix) lines.push(`| src/${o.pkg} | \`${o.chunkPrefix}\` | ${o.goldenBacked ? `yes` : `no`} |`);
    lines.push(``);
    lines.push(`Fix direction: add the chunk to the surface's matrix evidence (a matrix`);
    lines.push(`gap), never delete the manifest entry (the work is real).`);
  }
  if (l.errors.length > 0) {
    lines.push(``);
    lines.push(`## consistency errors (these fail --check)`);
    lines.push(``);
    for (const e of l.errors) lines.push(`- ${e}`);
  }
  lines.push(``);
  return lines.join(`\n`);
}
