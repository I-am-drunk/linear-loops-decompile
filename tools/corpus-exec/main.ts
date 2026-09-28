/**
 * corpus-exec CLI (G1; SPECS/ui-parity.md "golden tier"):
 *
 *   node --experimental-strip-types tools/corpus-exec/main.ts run <case.json> [--corpus DIR] [--out FILE]
 *   node --experimental-strip-types tools/corpus-exec/main.ts verify <case.json> [--corpus DIR] [--expected FILE]
 *
 * Exit codes: 0 ok · 1 verify mismatch · 2 usage/tooling error.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { expectedBytes, loadCase, runCase } from "./run.ts";
import { serialize } from "./serialize.ts";

function usage(): void {
  console.error(
    `corpus-exec — execute a corpus chunk offline and record its outputs (golden authoring)\n` +
      `\n` +
      `usage:\n` +
      `  corpus-exec run <case.json>    [--corpus pipeline/corpus] [--out FILE]\n` +
      `  corpus-exec verify <case.json> [--corpus pipeline/corpus] [--expected FILE]\n` +
      `\n` +
      `run    → emit a DRAFT <case>.expected.json (author must hand-verify before commit)\n` +
      `verify → rebuild the sandbox, re-execute, byte-compare against the committed golden`,
  );
}

function defaultExpectedPath(casePath: string): string {
  return join(dirname(casePath), `${casePath.split(`/`).pop()?.replace(/\.json$/, ``) ?? `case`}.expected.json`);
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const cmd = args[0];
  if (cmd !== `run` && cmd !== `verify`) {
    usage();
    return 2;
  }
  const casePath = args[1];
  if (casePath === undefined || casePath.startsWith(`--`)) {
    usage();
    return 2;
  }
  let corpus = `pipeline/corpus`;
  let out: string | undefined;
  let expected: string | undefined;
  for (let i = 2; i < args.length; i += 1) {
    const take = (): string => {
      i += 1;
      const v = args[i];
      if (v === undefined) throw new Error(`${args[i - 1]} needs a value`);
      return v;
    };
    switch (args[i]) {
      case `--corpus`: corpus = take(); break;
      case `--out`: out = take(); break;
      case `--expected`: expected = take(); break;
      default: throw new Error(`unknown flag: ${args[i]}`);
    }
  }

  const c = loadCase(casePath);
  const result = await runCase(corpus, dirname(casePath), c, (line) => console.error(line));
  const bytes = expectedBytes(result);

  if (cmd === `run`) {
    const target = out ?? defaultExpectedPath(casePath);
    writeFileSync(target, bytes);
    console.error(`draft golden written: ${target}`);
    console.error(`DRAFT — hand-verify every output region against the corpus source before committing (README).`);
    return 0;
  }

  const expectedPath = expected ?? defaultExpectedPath(casePath);
  let want: string;
  try {
    want = readFileSync(expectedPath, `utf8`);
  } catch {
    console.error(`verify: no committed golden at ${expectedPath}`);
    return 2;
  }
  if (bytes === want) {
    console.error(`verify: OK — byte-identical re-execution (${expectedPath})`);
    return 0;
  }
  // Locate the divergence: output vs provenance-only (corpus refresh drift).
  let wantParsed: { output?: unknown };
  try {
    wantParsed = JSON.parse(want) as { output?: unknown };
  } catch {
    console.error(`verify: MISMATCH — committed golden at ${expectedPath} is not valid JSON; a corrupt golden is a red, review it.`);
    return 1;
  }
  if (wantParsed === null || typeof wantParsed !== `object`) {
    console.error(`verify: MISMATCH — committed golden at ${expectedPath} is not a golden object (got ${wantParsed === null ? `null` : typeof wantParsed}); a corrupt golden is a red, review it.`);
    return 1;
  }
  const outputMatches = JSON.stringify(serialize(result.output), null, 2) === JSON.stringify(wantParsed.output, null, 2);
  if (outputMatches) {
    // An UNKNOWN corpus head on the re-run (no stamp, corpus dir not a git
    // toplevel — issue #250) is informational, not a mismatch: the byte-compare
    // on output plus chunkHashes is the oracle. Any OTHER provenance delta
    // (chunk hashes, stubs, serializer, or a DIFFERENT known head) stays red.
    const wantProv = (wantParsed as { provenance?: Record<string, unknown> }).provenance;
    const gotProv = result.provenance as unknown as Record<string, unknown>;
    if (wantProv !== undefined && gotProv[`corpusHead`] === null) {
      const scrub = (p: Record<string, unknown>): string => JSON.stringify({ ...p, corpusHead: null }, null, 2);
      if (scrub(wantProv) === scrub(gotProv)) {
        console.error(`verify: OK — output byte-identical, chunk hashes identical; corpus head unknown on this machine (no <corpus>/HEAD stamp and not a git toplevel — see pipeline/README.md fetch recipe).`);
        return 0;
      }
    }
    console.error(`verify: OUTPUT matches but provenance differs (corpus refresh or stub change) — re-record deliberately, in a reviewed PR.`);
  } else {
    console.error(`verify: MISMATCH in output (${expectedPath}) — upstream drift or a bad golden; diff and review before touching the golden.`);
  }
  return 1;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`corpus-exec: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  },
);
