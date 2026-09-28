// Linear client bundle analyzer: GraphQL ops, sync models (+fields), routes, chunk map.
// Run AFTER prettify.mjs. Reads pretty/client/*.js -> writes analysis/*.json + extracts/.
//
// TREE CONTRACT (issue #241): the pretty tree is MIXED-LAYOUT. Since the #232
// prettify gate, chunks that fail parse/token-signature validation are stored
// as byte-exact RAW (minified) fallbacks; everything else is beautified. Every
// grammar below must therefore be LAYOUT-INVARIANT: match token sequences with
// \s* between tokens, never a fixed spacing ("x = class") or a fixed
// line shape. History that motivates this: the pre-#232 beautifier inserted
// newline+indent INSIDE template literals (`M(`\n  AiPromptMemory`)`), which
// silently hid 49 model registrations and 5 GraphQL ops from the fixed-layout
// grammars — the 2026-09-26 baseline (258 ops / 87 models) undercounted the
// real corpus (376 / 136). Names captured from template literals are
// whitespace-normalized for the same reason. pipeline/analyze.test.mjs holds
// the invariance: identical facts from a beautified and a minified rendering
// of the same code.
import fs from 'fs'; import path from 'path';
const DIR = 'pretty/client';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
fs.mkdirSync('analysis', { recursive: true });

// ---- GraphQL operations ----
// Anchored grammar (#241): match a backtick that directly OPENS an operation
// document, then walk to its closing backtick honoring escapes. Global
// literal-pairing (`((?:\\.|[^`\\])*)`) is structurally wrong on this corpus:
// one escape sequence the "." cannot cross (an escaped newline from the
// beautifier) desyncs the pairing for the rest of the file, and unrelated
// literals with backslashes shift which spans look like literals at all —
// measured on 1.32.4, it reported 258 ops where the corpus holds 376 (the
// anchored grammar agrees exactly with the raw minified tree, 376 = 376).
const graphqlOps = new Map();
function extractGraphQL(d, f) {
  const anchor = /`\s*(query|mutation|subscription)\s+([A-Za-z]\w*)/g;
  let m;
  while ((m = anchor.exec(d))) {
    // An ESCAPED backtick (\`) inside an enclosing literal is not a template
    // opener; walking from it would swallow the enclosing literal's real
    // close and fabricate an op.
    if (m.index > 0 && d[m.index - 1] === '\\') continue;
    const [, type, name] = m;
    // Walk from the opening backtick to the matching close, skipping \x pairs.
    let i = m.index + 1, doc = null;
    while (i < d.length) {
      const c = d[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { doc = d.slice(m.index + 1, i); break; }
      i++;
    }
    if (doc === null) continue; // unterminated: not a literal we can read
    if (!graphqlOps.has(name)) graphqlOps.set(name, { type, doc, file: f });
  }
}
// ---- Models with fields ----
const models = {};
function addModel(d, name, varName, idx, file) {
  if (!/^[A-Z]/.test(name) || models[name]) return;
  models[name] = { file, fields: [] };
  // Layout-invariant class locator (#241): the registration's class body is
  // the LAST `<var> = class` (possibly `<var> = <alias> = class`) before the
  // decorator call. Beautified spacing ("Zt = class") and minified spacing
  // ("Zt=class") must both match.
  // (?<![\w$]) / (?![\w$]): identifier boundaries — for var `A`, never match
  // inside `ZA = class` or against `AB.prototype` (#254 review).
  const ve = varName.replace(/\$/g, '\\$');
  const classRe = new RegExp('(?<![\\w$])' + ve + '(?![\\w$])\\s*=\\s*(?:[A-Za-z$_][\\w$]*\\s*=\\s*)?class', 'g');
  let classStart = -1;
  const head = d.slice(0, idx);
  for (const m of head.matchAll(classRe)) classStart = m.index;
  if (classStart === -1) return;
  const seg = d.slice(classStart, idx);
  const re = new RegExp('(?<![\\w$])' + ve + '\\.prototype\\s*,\\s*`\\s*([a-zA-Z0-9_]+)\\s*`', 'g');
  models[name].fields = [...new Set([...seg.matchAll(re)].map(x => x[1]))];
}
// ---- Routes & chunks ----
const routes = []; const chunkInfo = [];

for (const f of files) {
  const d = fs.readFileSync(path.join(DIR, f), 'utf8');
  extractGraphQL(d, f);
  // Model-name literals are whitespace-normalized: the pre-#232 beautifier
  // could inject newline+indent inside the template literal (#241).
  for (const m of d.matchAll(/(?<![\w$])([A-Za-z$_][\w$]*)\s*=\s*C\(\s*\[\s*M\(\s*`\s*([A-Za-z0-9]+)\s*`\s*\)\s*\]\s*,\s*\1\s*\)/g)) addModel(d, m[2], m[1], m.index, f);
  for (const m of d.matchAll(/C\(\s*\[\s*M\(\s*`\s*([A-Za-z0-9]+)\s*`\s*\)\s*\]\s*,\s*([A-Za-z$_][\w$]*)\s*\)/g)) addModel(d, m[1], m[2], m.index, f);
  for (const m of d.matchAll(/Gt\(`([^`]+)`/g)) routes.push({ path: m[1], file: f });
  for (const m of d.matchAll(/path:\s*`(\/[^`]*)`/g)) routes.push({ path: m[1], file: f });
  // Org-scoped route literals anywhere (match helpers, redirects, deep
  // links) — the table registrations above miss these; issue #174. Scoped to
  // the /:orgKey/ prefix deliberately: unscoped '/' literals are dominated by
  // API endpoints and asset paths, while Linear's app routes are all
  // orgKey-scoped. Route charset only; no dots (assets), no '//' (URLs).
  for (const m of d.matchAll(/`(\/:orgKey\/[^`\\]{1,120})`/g)) {
    const p = m[1];
    if (!/^\/:orgKey\/[A-Za-z0-9:][A-Za-z0-9/:_*?&=-]*\??$/.test(p)) continue;
    if (p.includes('.') || p.includes('//')) continue;
    routes.push({ path: p, file: f });
  }
  const comps = [...d.matchAll(/\.displayName\s*=\s*`([A-Za-z0-9]+)`/g)].map(x => x[1]);
  chunkInfo.push({ file: f, bytes: d.length, components: [...new Set(comps)].slice(0, 8) });
}

fs.writeFileSync('analysis/graphql-ops.json', JSON.stringify([...graphqlOps.entries()].map(([name, v]) => ({ name, ...v })), null, 2));
fs.writeFileSync('analysis/models.json', JSON.stringify(Object.entries(models).map(([name, v]) => ({ name, ...v })), null, 2));
// Dedupe by (path, file): the literal extractor above re-finds routes the
// table patterns already caught.
const seenRoutes = new Set();
const routesDeduped = routes.filter(r => {
  const k = `${r.path}${r.file}`;
  if (seenRoutes.has(k)) return false;
  seenRoutes.add(k);
  return true;
});

fs.writeFileSync('analysis/routes.json', JSON.stringify(routesDeduped, null, 2));
fs.writeFileSync('analysis/chunks.json', JSON.stringify(chunkInfo, null, 2));

// ---- extracts/ markdown (regenerate repo artifacts) ----
const EXTRACTS = process.env.EXTRACTS_DIR || 'extracts';
let prov = 'production web client bundle';
try { const v = JSON.parse(fs.readFileSync('app/VERSION.json', 'utf8')); prov = `production web client bundle, desktop v${v.version} (${v.date})`; } catch {}
const stamp = `Source: ${prov}. Factual interface data for interoperability. Regenerate with pipeline/run.sh`;
fs.mkdirSync(EXTRACTS, { recursive: true });
const names = Object.keys(models).sort();
let md = `# Linear Sync Model Registry (extracted reference)\n\n${stamp}. Total models: ${names.length}\n\n`;
for (const n of names) {
  md += `## ${n}\n\n`;
  md += models[n].fields.length ? models[n].fields.map(f => `- \`${f}\``).join('\n') + '\n\n' : '- (not statically extractable; see prettified source)\n\n';
}
fs.writeFileSync(`${EXTRACTS}/models.md`, md);
let gd = `# Linear Client GraphQL Operations (condensed catalog)\n\n${stamp}. ${graphqlOps.size} operations.\n\n`;
for (const [name, op] of [...graphqlOps.entries()].sort()) {
  const full = (op.doc.match(/\(([^)]*)\)/) || [, ''])[1].replace(/\s+/g, ' ');
  // Mark a cut signature as cut (#254 review): an unfinished `$var` or type
  // name presented as a complete signature is a wrong fact, not a short one.
  const sig = full.length > 160 ? full.slice(0, 160) + ' …[truncated]' : full;
  gd += `- **${op.type}** \`${name}\`${sig ? ' `(' + sig + ')`' : ''}\n`;
}
fs.writeFileSync(`${EXTRACTS}/graphql-ops.md`, gd);
const uniqueRoutePaths = new Set(routesDeduped.map(r => r.path)).size;
console.log(`ops: ${graphqlOps.size}, models: ${names.length} (${names.filter(n=>models[n].fields.length).length} with fields), routes: ${uniqueRoutePaths} unique paths (${routesDeduped.length} path-and-file records), chunks: ${chunkInfo.length}`);
