/** G2 coverage-ledger tests — committed inputs only, corpus-free by design. */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildLedger, chunkRefsFromMatrix, refCovers, renderReport } from "./ledger.ts";

function fixtureRepo(opts: { manifest?: unknown; goldenFiles?: string[]; matrix?: string }): string {
  const root = mkdtempSync(join(tmpdir(), `coverage-`));
  mkdirSync(join(root, `docs`), { recursive: true });
  writeFileSync(
    join(root, `docs`, `feature-matrix.md`),
    opts.matrix ??
      `## A. Loops management UI\n\n| Feature | Corpus evidence | Status |\n|---|---|---|\n| Loops management page | \`LoopsManagementPage.{BAhf8Ti3,CVnaEF7c}.js\` | corpus |\n| Theme | \`ThemeHelper.CeMKYPhf.js\` | corpus |\n`,
  );
  if (opts.manifest !== undefined) {
    const pkg = join(root, `src`, `pkg-a`);
    mkdirSync(join(pkg, `golden`), { recursive: true });
    writeFileSync(join(pkg, `corpus-manifest.json`), JSON.stringify(opts.manifest, null, 2));
    for (const f of opts.goldenFiles ?? []) writeFileSync(join(pkg, `golden`, f), `{}\n`);
  } else {
    mkdirSync(join(root, `src`), { recursive: true });
  }
  return root;
}

test(`matrix grammar: brace sets expand, prefixes and bare names survive, route/op cells ignored`, () => {
  const rows = chunkRefsFromMatrix(
    `## D. Chat substrate\n\n| Feature | Corpus evidence | Status |\n|---|---|---|\n| Send | mutation \`AiConversationSendMessage\` (returns \`success\`) | corpus |\n| Chat UI | \`LinearAgentMessages.BuUfncdI.js\`, \`AgentPanel*\` chunks | corpus |\n| Runs page | route \`/:orgKey/loop/:loopId/runs\`; \`AutomationRunsPage.{CwJzxL5C,DR4Bss0s}.js\` | corpus |\n`,
  );
  const chunks = rows.flatMap((r) => r.chunks);
  assert.ok(chunks.includes(`LinearAgentMessages.BuUfncdI.js`));
  assert.ok(chunks.includes(`AutomationRunsPage.CwJzxL5C.js`));
  assert.ok(chunks.includes(`AutomationRunsPage.DR4Bss0s.js`));
  // op names are backticked too — they enter as bare refs; the ledger treats
  // them as chunks-to-cover which is the honest over-count, never an
  // undercount. Route strings never match the grammar.
  assert.ok(!chunks.some((c) => c.includes(`/`)));
});

test(`refCovers: dot-boundary prefix only, never substring`, () => {
  assert.ok(refCovers(`ThemeHelper`, `ThemeHelper.CeMKYPhf.js`));
  assert.ok(refCovers(`ThemeHelper.CeMKYPhf.js`, `ThemeHelper`));
  assert.ok(!refCovers(`Theme`, `ThemeHelper.CeMKYPhf.js`));
  assert.ok(!refCovers(`AutomationsList`, `AutomationsListItem.X.js`));
});

test(`golden classification requires a RESOLVABLE committed golden, dangling id -> GAP + error`, () => {
  const manifest = {
    source: `test`,
    reimplements: [{ chunkPrefix: `ThemeHelper`, exports: [{ minified: `g`, meaning: `gen` }] }],
    goldens: [`vectors`],
  };
  const withGolden = buildLedger(fixtureRepo({ manifest, goldenFiles: [`vectors.json`] }));
  assert.equal(withGolden.golden, 1);
  assert.equal(withGolden.errors.length, 0);
  const dangling = buildLedger(fixtureRepo({ manifest, goldenFiles: [] }));
  assert.equal(dangling.golden, 0);
  assert.ok(dangling.errors.some((e) => e.includes(`dangling`) || e.includes(`no committed file`)));
});

test(`unclaimed chunks are GAP, loudly, and the report prints them`, () => {
  const l = buildLedger(fixtureRepo({}));
  assert.equal(l.golden, 0);
  assert.ok(l.gap >= 3); // both LoopsManagementPage hashes + ThemeHelper
  const report = renderReport(l);
  assert.ok(report.includes(`**GAP**`));
  assert.ok(report.includes(`LoopsManagementPage.BAhf8Ti3.js`));
});

test(`invalid manifest JSON is a consistency error, not a crash`, () => {
  const root = fixtureRepo({});
  const pkg = join(root, `src`, `pkg-bad`);
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, `corpus-manifest.json`), `{not json`);
  const l = buildLedger(root);
  assert.ok(l.errors.some((e) => e.includes(`invalid JSON`)));
});

test(`missing provenance source is a consistency error`, () => {
  const l = buildLedger(
    fixtureRepo({ manifest: { source: ``, reimplements: [], goldens: [] } }),
  );
  assert.ok(l.errors.some((e) => e.includes(`missing "source" provenance`)));
});

test(`REAL repo: ledger builds, ui-theme reference manifest is golden-backed, report regenerates identically`, () => {
  const repoRoot = join(import.meta.dirname, `..`, `..`);
  const l = buildLedger(repoRoot);
  assert.ok(l.surfaces > 20, `expected the real matrix inventory, got ${l.surfaces} surfaces`);
  assert.ok(l.packages.includes(`ui-theme`));
  assert.equal(l.errors.length, 0, l.errors.join(`; `));
  // The matrix names ThemeHelper as behavior, not as chunk evidence — the
  // ui-theme work must therefore surface in the off-matrix table (loud),
  // never silently boost the golden count.
  const themeRows = l.rows.filter((r) => r.chunk.startsWith(`ThemeHelper`));
  for (const r of themeRows) assert.equal(r.cls, `golden`);
  if (themeRows.length === 0) {
    assert.ok(l.offMatrix.some((o) => o.pkg === `ui-theme` && o.goldenBacked), `ui-theme must appear off-matrix when the matrix lacks its chunks`);
  }
  // determinism: two builds render byte-identically (--check's regeneration bar)
  assert.equal(renderReport(l), renderReport(buildLedger(repoRoot)));
});
