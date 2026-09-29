/**
 * remap-graph CLI (#295 assembly-track sizing):
 *
 *   node --experimental-strip-types tools/remap-graph/main.ts report [--corpus DIR] [--out-md FILE] [--out-json FILE]
 *
 * report → analyze the raw corpus tree against tools/remap-graph/roots.json
 *          and write extracts/assembly-graph.{md,json} (or the given paths).
 *
 * Exit codes: 0 ok · 2 usage/tooling error (no corpus, bad config).
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { analyze, loadGraph, type RootsConfig } from "./graph.ts";
import { renderJson, renderMarkdown } from "./render.ts";

function main(): number {
  const args = process.argv.slice(2);
  if (args[0] !== `report`) {
    console.error(`usage: remap-graph report [--corpus pipeline/corpus] [--out-md extracts/assembly-graph.md] [--out-json extracts/assembly-graph.json]`);
    return 2;
  }
  let corpus = `pipeline/corpus`;
  let outMd = `extracts/assembly-graph.md`;
  let outJson = `extracts/assembly-graph.json`;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === `--corpus`) corpus = args[++i] ?? corpus;
    else if (args[i] === `--out-md`) outMd = args[++i] ?? outMd;
    else if (args[i] === `--out-json`) outJson = args[++i] ?? outJson;
    else {
      console.error(`unknown arg: ${args[i]}`);
      return 2;
    }
  }
  const clientDir = join(corpus, `client`);
  if (!existsSync(clientDir)) {
    console.error(`remap-graph: no raw corpus at ${clientDir} — fetch the vault (pipeline/README.md fast path). The RAW tree is required; the pretty tree is execution-corrupted (issue #225 R1) and its import lines can differ.`);
    return 2;
  }
  let config: RootsConfig;
  try {
    config = JSON.parse(readFileSync(new URL(`./roots.json`, import.meta.url), `utf8`)) as RootsConfig;
  } catch (e) {
    console.error(`remap-graph: cannot read roots.json — ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  const headPath = join(corpus, `.corpus-head`);
  const corpusHead = existsSync(headPath) ? readFileSync(headPath, `utf8`).trim() : `unknown`;
  const graph = loadGraph(clientDir);
  const a = analyze(graph, config, corpusHead);
  if (a.missingRoots.length > 0) {
    console.error(`remap-graph: WARNING — ${a.missingRoots.length} configured root(s) missing from this corpus (drift): ${a.missingRoots.join(`, `)}`);
  }
  writeFileSync(outMd, renderMarkdown(a));
  writeFileSync(outJson, renderJson(a));
  console.error(`remap-graph: wrote ${outMd} and ${outJson} (corpus head ${corpusHead})`);
  return 0;
}

process.exit(main());
