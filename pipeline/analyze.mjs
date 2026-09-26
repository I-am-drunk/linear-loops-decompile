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
  const comps = [...d.matchAll(/\.displayName\s*=\s*`([A-Za-z0-9]+)`/g)].map(x => x[1]);
  chunkInfo.push({ file: f, bytes: d.length, components: [...new Set(comps)].slice(0, 8) });
}

fs.writeFileSync('analysis/graphql-ops.json', JSON.stringify([...graphqlOps.entries()].map(([name, v]) => ({ name, ...v })), null, 2));
fs.writeFileSync('analysis/models.json', JSON.stringify(Object.entries(models).map(([name, v]) => ({ name, ...v })), null, 2));
fs.writeFileSync('analysis/routes.json', JSON.stringify(routes, null, 2));
fs.writeFileSync('analysis/chunks.json', JSON.stringify(chunkInfo, null, 2));

// ---- extracts/ markdown (regenerate repo artifacts) ----
fs.mkdirSync('extracts', { recursive: true });
const names = Object.keys(models).sort();
let md = `# Linear Sync Model Registry (extracted reference)\n\nSource: production web client bundle. Total models: ${names.length}\n\n`;
for (const n of names) {
  md += `## ${n}\n\n`;
  md += models[n].fields.length ? models[n].fields.map(f => `- \`${f}\``).join('\n') + '\n\n' : '- (not statically extractable — see prettified source)\n\n';
}
fs.writeFileSync('extracts/models.md', md);
let gd = `# Linear Client GraphQL Operations (condensed catalog)\n\n${graphqlOps.size} operations.\n\n`;
for (const [name, op] of [...graphqlOps.entries()].sort()) {
  const sig = (op.doc.match(/\(([^)]*)\)/) || [, ''])[1].replace(/\s+/g, ' ').slice(0, 160);
  gd += `- **${op.type}** \`${name}\`${sig ? ' — `(' + sig + ')`' : ''}\n`;
}
fs.writeFileSync('extracts/graphql-ops.md', gd);
console.log(`ops: ${graphqlOps.size}, models: ${names.length} (${names.filter(n=>models[n].fields.length).length} with fields), routes: ${routes.length}, chunks: ${chunkInfo.length}`);
