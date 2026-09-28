// analyze.mjs layout-invariance drift test (issue #241).
//
// The pretty tree is MIXED-LAYOUT since #232 (beautified chunks + byte-exact
// raw fallbacks), so every analyze grammar must extract the SAME facts from a
// beautified and a minified rendering of the same code. This test builds two
// fixture corpora that differ only in layout — including the two measured
// pathologies that hid facts on 1.32.4:
//   (a) newline+indent injected INSIDE template literals by the old
//       beautifier (`M(`\n  AiPromptMemory`)`), which hid 49 model
//       registrations from the fixed-layout grammar;
//   (b) an escaped newline inside an unrelated string literal, which desynced
//       the old global literal-pairing regex and dropped 5+ GraphQL ops
//       (258 reported vs 376 real).
// It then runs analyze.mjs on each and asserts facts are identical, and that
// each pathology is actually covered (the facts include the ones the old
// grammars missed).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ANALYZE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'analyze.mjs');

// One piece of "client code", rendered two ways. Facts it carries:
// 2 models (Alpha with 2 fields, BetaThing with 1), 3 GraphQL ops
// (AlphaQuery, TrickyMutation AFTER an escaped-newline literal, WrappedQuery
// with the corrupted-literal leading whitespace), 2 routes.
const MIN = [
  // model Alpha: minified spacing, alias chain
  'var A1,ZA=A1=class extends x{},C([O],ZA.prototype,`title`,null),C([O],ZA.prototype,`sortOrder`,null),ZA=A1=C([M(`Alpha`)],ZA);',
  // model BetaThing
  'var ZB=class extends x{};C([O],ZB.prototype,`name`,null),ZB=C([M(`BetaThing`)],ZB);',
  // op 1
  'function q1(e){return e.query($n`query AlphaQuery($id: String!) { alpha(id: $id) { id } }`)}',
  // an unrelated literal containing an escaped newline + escaped backslash —
  // the byte-identical twin of PRETTY's SEP (layout parity demands identical
  // template CONTENTS; the escaped newline is legal in minified output too)
  // and the desync vector for global literal pairing (#254 review).
  'const SEP=`a\\\n\\\\`;',
  // op 2, after the desync vector
  'function q2(e){return e.mutate($n`mutation TrickyMutation($x: Int) { tricky(x: $x) }`)}',
  // op 3
  'function q3(e){return e.query($n`query WrappedQuery { wrapped { id } }`)}',
  // routes
  'Gt(`/settings/alpha`);const P={path:`/:orgKey/alpha/:alphaId`};',
].join('');

// The beautified rendering: same tokens, different whitespace — including the
// two pathologies (newline inside the M(`…`) literal; escaped newline in SEP).
const PRETTY = [
  'var A1, ZA = A1 = class extends x {},\n',
  '  C([O], ZA.prototype, `title`, null),\n',
  '  C([O], ZA.prototype, `sortOrder`, null),\n',
  '  ZA = A1 = C([M(`\n          Alpha`)], ZA);\n', // pathology (a)
  'var ZB = class extends x {};\n',
  'C([O], ZB.prototype, `name`, null), ZB = C([M(`BetaThing`)], ZB);\n',
  'function q1(e) {\n  return e.query($n`query AlphaQuery($id: String!) { alpha(id: $id) { id } }`)\n}\n',
  'const SEP = `a\\\n\\\\`;\n', // pathology (b): escaped newline inside the literal (same contents as MIN)
  'function q2(e) {\n  return e.mutate($n`\n    mutation TrickyMutation($x: Int) { tricky(x: $x) }`)\n}\n',
  'function q3(e) {\n  return e.query($n`\n    query WrappedQuery { wrapped { id } }`)\n}\n',
  'Gt(`/settings/alpha`);\nconst P = {\n  path: `/:orgKey/alpha/:alphaId`\n};\n',
].join('');

function runAnalyze(chunkText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-drift-'));
  fs.mkdirSync(path.join(dir, 'pretty/client'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pretty/client/Fixture.AAAA.js'), chunkText);
  execFileSync(process.execPath, [ANALYZE], { cwd: dir, env: { ...process.env, EXTRACTS_DIR: path.join(dir, 'extracts') } });
  const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, 'analysis', f), 'utf8'));
  const facts = {
    ops: read('graphql-ops.json').map(({ name, type }) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name)),
    models: read('models.json').map(({ name, fields }) => ({ name, fields: [...fields].sort() })).sort((a, b) => a.name.localeCompare(b.name)),
    routes: [...new Set(read('routes.json').map((r) => r.path))].sort(),
  };
  fs.rmSync(dir, { recursive: true, force: true });
  return facts;
}

test('minified and beautified renderings yield identical facts', () => {
  const min = runAnalyze(MIN);
  const pretty = runAnalyze(PRETTY);
  assert.deepEqual(pretty, min);
});

test('the facts include what the old grammars missed', () => {
  const facts = runAnalyze(PRETTY);
  // pathology (a): the corrupted-literal model still registers, with fields
  const alpha = facts.models.find((m) => m.name === 'Alpha');
  assert.ok(alpha, 'Alpha model extracted despite newline inside its name literal');
  assert.deepEqual(alpha.fields, ['sortOrder', 'title']);
  const beta = facts.models.find((m) => m.name === 'BetaThing');
  assert.ok(beta && beta.fields.length === 1, 'BetaThing extracted with its field');
  // pathology (b): ops after the escaped-newline literal survive
  const names = facts.ops.map((o) => o.name);
  assert.deepEqual(names, ['AlphaQuery', 'TrickyMutation', 'WrappedQuery']);
  assert.deepEqual(facts.routes, ['/:orgKey/alpha/:alphaId', '/settings/alpha']);
});

test('signature text is layout-invariant across pretty and raw renderings', () => {
  // #254 review (the punctuation-normalization thread): a beautifier may
  // render `String !`, `[ ID ! ]`, `$a , $b` — the catalog signature must be
  // byte-identical to the minified rendering's.
  const MIN_SIG = 'function s1(e){return e.query($n`query SigQuery($id: String!, $refs: [ID!]) { sig(id: $id) { id } }`)}';
  const PRETTY_SIG = 'function s1(e) {\n  return e.query($n`query SigQuery($id: String ! , $refs: [ ID ! ]) { sig(id: $id) { id } }`)\n}\n';
  const min = runAnalyzeMd(MIN_SIG);
  const pretty = runAnalyzeMd(PRETTY_SIG);
  assert.equal(pretty, min);
  assert.match(min, /\(\$id: String!, \$refs: \[ID!\]\)/);
});

test('signature normalization never rewrites a quoted default value', () => {
  // #254 CodeRabbit thread: `= "a , b"` is a VALUE — collapsing whitespace or
  // dropping spaces around punctuation INSIDE it fabricates a different fact.
  // Only the syntax between string literals may be normalized.
  const MIN_Q = 'function s1(e){return e.query($n`query SigQuery($sep: String = "a , b", $pad: String = "two  spaces") { sig { id } }`)}';
  const PRETTY_Q = 'function s1(e) {\n  return e.query($n`query SigQuery($sep: String = "a , b" , $pad: String = "two  spaces") { sig { id } }`)\n}\n';
  const min = runAnalyzeMd(MIN_Q);
  const pretty = runAnalyzeMd(PRETTY_Q);
  assert.equal(pretty, min);
  assert.match(min, /"a , b"/); // the value's spaces survive
  assert.match(min, /"two  spaces"/); // repeated spaces inside a value survive
});

// Like runAnalyze but returns the SigQuery line of the generated
// extracts/graphql-ops.md (the human-facing signature bytes the review is
// about), not the JSON facts.
function runAnalyzeMd(chunkText) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-sig-'));
  fs.mkdirSync(path.join(dir, 'pretty/client'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'pretty/client/Fixture.AAAA.js'), chunkText);
  execFileSync(process.execPath, [ANALYZE], { cwd: dir, env: { ...process.env, EXTRACTS_DIR: path.join(dir, 'extracts') } });
  const md = fs.readFileSync(path.join(dir, 'extracts', 'graphql-ops.md'), 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  const line = md.split('\n').find((l) => l.includes('SigQuery'));
  assert.ok(line, 'SigQuery present in the catalog');
  return line;
}
