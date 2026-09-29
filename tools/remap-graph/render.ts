/**
 * remap-graph renderers: the human report (extracts/assembly-graph.md) and
 * the machine snapshot (extracts/assembly-graph.json). Emitted content is
 * extracted fact only: names, counts, byte sizes, symbol identifiers.
 */

import type { Analysis } from "./graph.ts";

function mb(n: number): string {
  return `${(n / 1_000_000).toFixed(1)} MB`;
}

export function renderJson(a: Analysis): string {
  // stable, reviewable diff: fixed key order via the object literal, sorted lists upstream
  return `${JSON.stringify(a, null, 2)}\n`;
}

export function renderMarkdown(a: Analysis): string {
  const lines: string[] = [];
  lines.push(`# assembly-graph: the #295 widened-scope import closure, measured`);
  lines.push(``);
  lines.push(
    `GENERATED — do not hand-edit. Regenerate: \`node --experimental-strip-types tools/remap-graph/main.ts report\` (needs the local corpus; see tools/remap-graph/README.md). Corpus head: \`${a.corpusHead}\` (${a.chunkCount} chunks, ${mb(a.totalBytes)}).`,
  );
  lines.push(``);
  lines.push(`## Roots (tools/remap-graph/roots.json)`);
  lines.push(``);
  for (const r of a.roots) lines.push(`- \`${r}\``);
  if (a.missingRoots.length > 0) {
    lines.push(``);
    lines.push(`MISSING from this corpus (drift signal): ${a.missingRoots.map((r) => `\`${r}\``).join(`, `)}`);
  }
  lines.push(``);
  lines.push(`## Closure`);
  lines.push(``);
  lines.push(`| measure | chunks | bytes |`);
  lines.push(`|---|---:|---:|`);
  lines.push(`| full transitive closure | ${a.fullClosure.chunks} | ${mb(a.fullClosure.bytes)} |`);
  for (const m of a.monsters) lines.push(`| monster: \`${m.name}\` | 1 | ${mb(m.bytes)} |`);
  lines.push(`| reachable ONLY via monsters | ${a.monsterOnly.chunks} | ${mb(a.monsterOnly.bytes)} |`);
  lines.push(`| assembly set (closure minus monsters) | ${a.assembly.chunks} | ${mb(a.assembly.bytes)} |`);
  lines.push(`| — vendor-named (consumed, not reimplemented) | ${a.vendor.chunks} | ${mb(a.vendor.bytes)} |`);
  lines.push(`| — app-named (the real assembly surface) | ${a.app.chunks} | ${mb(a.app.bytes)} |`);
  lines.push(``);
  lines.push(
    `Assembly-size histogram: ${a.histogram.under12k} chunks < 12 KB · ${a.histogram.from12to64k} at 12–64 KB · ${a.histogram.over64k} ≥ 64 KB.`,
  );
  lines.push(``);
  lines.push(`## Fan-in (build-order signal; top ${a.fanInTop} within the assembly set)`);
  lines.push(``);
  lines.push(`| importers | chunk | bytes | vendor |`);
  lines.push(`|---:|---|---:|---|`);
  for (const f of a.fanIn.slice(0, a.fanInTop)) {
    lines.push(`| ${f.importers} | \`${f.chunk}\` | ${f.bytes} | ${f.vendor ? `yes` : ``} |`);
  }
  lines.push(``);
  lines.push(`## Monster demand (facade surface per #295 R-FACADE)`);
  lines.push(``);
  lines.push(`| monster | exports total | demanded by assembly set | importing chunks |`);
  lines.push(`|---|---:|---:|---:|`);
  for (const d of a.demands) {
    lines.push(`| \`${d.monster}\` | ${d.totalExports} | ${d.demanded.length} | ${d.importers.length} |`);
  }
  lines.push(``);
  lines.push(
    `Full demanded-symbol lists and the complete assembly file list live in the machine snapshot \`extracts/assembly-graph.json\` (same generation run).`,
  );
  lines.push(``);
  return lines.join(`\n`);
}
