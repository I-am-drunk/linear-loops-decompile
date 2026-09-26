#!/usr/bin/env node
// Crawl Linear's production web client bundle (Vite/rolldown, served from static.linear.app).
// Entry chain: https://linear.app/login -> <script src="https://static.linear.app/client/assets/html.<HASH>.js">
// then BFS over "assets/<file>.js" references (incl. __vite__mapDeps arrays).
// 2026-09-26 result: 1,550 chunks, ~29.2 MB. No source maps are published.
import { execFileSync } from 'child_process';
import fs from 'fs';

const BASE = 'https://static.linear.app/client/';
fs.mkdirSync('client', { recursive: true });
const ASSET_RE = /"((?:\.\.\/)*assets\/[A-Za-z0-9_./-]+\.js)"/g;
const norm = p => { while (p.startsWith('../')) p = p.slice(3); return p; };

// 1. get the real app entry from the login page
const login = execFileSync('curl', ['-sfL', 'https://linear.app/login'], { maxBuffer: 1 << 24 }).toString();
const entry = login.match(/src=(https:\/\/static\.linear\.app\/client\/assets\/html\.[A-Za-z0-9_-]+\.js)/);
if (!entry) throw new Error('entry html.*.js not found — login page structure changed?');
execFileSync('curl', ['-sf', '-o', 'client/' + entry[1].split('/').pop(), entry[1]]);
console.log('entry:', entry[1]);

// 2. BFS crawl
const seen = new Set();
let frontier = [];
for (const f of fs.readdirSync('client'))
  for (const m of fs.readFileSync('client/' + f, 'utf8').matchAll(ASSET_RE)) {
    const p = norm(m[1]); if (!seen.has(p)) { seen.add(p); frontier.push(p); }
  }
for (let round = 1; frontier.length && round <= 15; round++) {
  const todo = frontier; frontier = [];
  const CHUNK = 24;
  for (let i = 0; i < todo.length; i += CHUNK) {
    await Promise.all(todo.slice(i, i + CHUNK).map(p => new Promise(res => {
      const fn = 'client/' + p.replace('assets/', '');
      if (fs.existsSync(fn)) return res(fn);
      try { execFileSync('curl', ['-sf', '-o', fn, BASE + p]); } catch { return res(null); }
      res(fn);
    }))).then(files => {
      for (const fn of files) {
        if (!fn) continue;
        for (const m of fs.readFileSync(fn, 'utf8').matchAll(ASSET_RE)) {
          const p2 = norm(m[1]); if (!seen.has(p2)) { seen.add(p2); frontier.push(p2); }
        }
      }
    });
  }
  console.log(`round ${round}: +${todo.length}, new: ${frontier.length}`);
}
const total = fs.readdirSync('client').reduce((s, f) => s + fs.statSync('client/' + f).size, 0);
console.log(`TOTAL: ${fs.readdirSync('client').length} chunks, ${(total / 1e6).toFixed(1)} MB`);
