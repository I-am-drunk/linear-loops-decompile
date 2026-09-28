/**
 * coverage CLI (G2):
 *
 *   node --experimental-strip-types tools/coverage/main.ts report [--repo DIR] [--out FILE]
 *   node --experimental-strip-types tools/coverage/main.ts check  [--repo DIR]
 *
 * report → print (or write) the per-surface ledger.
 * check  → corpus-free gate leg: manifests parse, provenance present, every
 *          declared golden id resolves to a committed file, and the join
 *          closes. Exit 1 on any consistency error. NEVER vacuous: with zero
 *          manifests it still validates the matrix join and says so (#225 D3
 *          — a green gate must attest something).
 *
 * Exit codes: 0 ok · 1 consistency errors · 2 usage/tooling error.
 */

import { writeFileSync } from "node:fs";
import { buildLedger, renderReport } from "./ledger.ts";

function main(): number {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd !== `report` && cmd !== `check`) {
    console.error(`usage: coverage report [--repo DIR] [--out FILE] | coverage check [--repo DIR]`);
    return 2;
  }
  let repo = `.`;
  let out: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === `--repo`) repo = args[++i] ?? `.`;
    else if (args[i] === `--out`) out = args[++i];
    else {
      console.error(`unknown arg: ${args[i]}`);
      return 2;
    }
  }
  let ledger;
  try {
    ledger = buildLedger(repo);
  } catch (e) {
    console.error(`coverage: cannot build ledger — ${e instanceof Error ? e.message : String(e)}`);
    return 2;
  }
  if (cmd === `report`) {
    const report = renderReport(ledger);
    if (out !== undefined) {
      writeFileSync(out, report);
      console.error(`coverage: wrote ${out}`);
    } else {
      console.log(report);
    }
    return ledger.errors.length > 0 ? 1 : 0;
  }
  // check
  console.error(
    `coverage check: ${ledger.surfaces} surfaces · ${ledger.chunks} chunks · ` +
      `${ledger.golden} golden · ${ledger.improvement} improvement · ${ledger.gap} GAP · ` +
      `${ledger.packages.length} manifest(s): ${ledger.packages.map((p) => `src/${p}`).join(`, `) || `none yet`}`,
  );
  if (ledger.errors.length > 0) {
    for (const e of ledger.errors) console.error(`coverage check: ERROR — ${e}`);
    return 1;
  }
  console.error(`coverage check: OK (corpus-free leg; golden claims all resolve to committed files)`);
  return 0;
}

process.exit(main());
