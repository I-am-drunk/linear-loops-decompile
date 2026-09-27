// Linear client bundle analyzer: GraphQL ops, sync models (+fields), routes, chunk map.
// Run AFTER prettify.mjs. Reads pretty/client/*.js -> writes analysis/*.json + extracts/.
import fs from 'fs'; import path from 'path';
const DIR = 'pretty/client';
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.js'));
fs.mkdirSync('analysis', { recursive: true });

// ---- GraphQL operations ----
const graphqlOps = new Map();
function extractGraphQL(d, f) {
  const re = /`((?:\\.|[^`\\])*)`/g; let m;
  while ((m = re.exec(d))) {
    const body = m[1];
    if (!/^\s*(query|mutation|subscription)\s+[A-Za-z]/.test(body)) continue;
    const t = body.match(/^\s*(query|mutation|subscription)\s+([A-Za-z]\w*)/);
    if (t && !graphqlOps.has(t[2])) graphqlOps.set(t[2], { type: t[1], doc: body, file: f });
  }
}
// ---- Models with fields ----
const models = {};
function addModel(d, name, varName, idx, file) {
  if (!/^[A-Z]/.test(name) || models[name]) return;
  const classStart = d.lastIndexOf(varName + ' = class', idx);
  models[name] = { file, fields: [] };
  if (classStart === -1) return;
  const seg = d.slice(classStart, idx);
  const re = new RegExp(varName.replace(/\$/g, '\\$') + '\\.prototype,\\s*`([a-zA-Z0-9_]+)`', 'g');
  models[name].fields = [...new Set([...seg.matchAll(re)].map(x => x[1]))];
}
// ---- Routes & chunks ----
const routes = []; const chunkInfo = [];

for (const f of files) {
  const d = fs.readFileSync(path.join(DIR, f), 'utf8');
  extractGraphQL(d, f);
  for (const m of d.matchAll(/([A-Za-z$_][\w$]*)\s*=\s*C\(\[M\(`([A-Za-z0-9]+)`\)\],\s*\1\)/g)) addModel(d, m[2], m[1], m.index, f);
  for (const m of d.matchAll(/C\(\[M\(`([A-Za-z0-9]+)`\)\],\s*([A-Za-z$_][\w$]*)\)/g)) addModel(d, m[1], m[2], m.index, f);
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
  const sig = (op.doc.match(/\(([^)]*)\)/) || [, ''])[1].replace(/\s+/g, ' ').slice(0, 160);
  gd += `- **${op.type}** \`${name}\`${sig ? ' `(' + sig + ')`' : ''}\n`;
}
fs.writeFileSync(`${EXTRACTS}/graphql-ops.md`, gd);
const uniqueRoutePaths = new Set(routesDeduped.map(r => r.path)).size;
console.log(`ops: ${graphqlOps.size}, models: ${names.length} (${names.filter(n=>models[n].fields.length).length} with fields), routes: ${uniqueRoutePaths} unique paths (${routesDeduped.length} path-and-file records), chunks: ${chunkInfo.length}`);
