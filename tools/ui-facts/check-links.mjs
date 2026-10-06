#!/usr/bin/env node
/**
 * Fail when a committed doc points at a repo path that does not exist.
 *
 * Motivation: this repo has shipped instructions referencing a private vault
 * repo that was removed, a `docs/PROVENANCE.md` that was deleted, and a
 * crawler skip-log that was never emitted. Every one of those taught the next
 * agent a procedure it could not perform. Stale pointers are not cosmetic —
 * they are the mechanism by which bad process propagates.
 *
 * Only checks inline-code paths that look repo-relative and file-like, so
 * prose and URLs are left alone.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ?? '.';
const DOCS = [];

(function walk(dir, depth = 0) {
  if (depth > 3) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    // archive/ is a historical record and SHOULD cite files that are gone;
    // rewriting its paths would falsify what it found. .claude/ holds scratch
    // worktrees that mirror the tree, so its docs are duplicates.
    if (['node_modules', '.git', '.claude'].includes(e.name)) continue;
    if (depth === 0 && ['corpus', 'archive'].includes(e.name)) continue;
    if (path.relative(ROOT, path.join(dir, e.name)) === path.join('pipeline', 'corpus')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1);
    else if (/\.md$/.test(e.name)) DOCS.push(p);
  }
})(ROOT);

// `src/ui/shell.ts`, `ci/check-ui.sh`, `docs/plan/mcp.md` — not prose, not URLs.
const PATH_RE = /`((?:src|ci|docs|tools|pipeline|extracts|\.agents|\.github)\/[A-Za-z0-9_./*-]+)`/g;

// A corpus makes pipeline/corpus/** citations checkable. Without one they are
// unverifiable rather than wrong, so they are skipped and counted.
const HAVE_CORPUS = fs.existsSync(path.join(ROOT, 'pipeline/corpus/client'));
let corpusSkipped = 0;

const bad = [];
let historical = 0;
for (const doc of DOCS) {
  const text = fs.readFileSync(doc, 'utf8');

  // A doc that declares itself a historical record SHOULD cite files that no
  // longer exist — rewriting its paths would falsify what it found. Opt out by
  // saying so in the first few lines, where a reader will see it too.
  if (/HISTORICAL RECORD/.test(text.split('\n').slice(0, 8).join('\n'))) {
    historical++;
    continue;
  }
  text.split('\n').forEach((line, n) => {
    for (const m of line.matchAll(PATH_RE)) {
      const ref = m[1];
      if (ref.includes('*') || ref.endsWith('/')) continue;      // globs, dirs
      // Corpus paths: gitignored, so unverifiable WITHOUT a corpus — but fully
      // checkable WITH one, and a stale pinned chunk is exactly the rot that
      // issue #330 is about. So skip only when there is no corpus, and count
      // what was skipped rather than hiding it (peer review, sess e8).
      if (/^pipeline\/corpus\//.test(ref)) {
        if (!HAVE_CORPUS) { corpusSkipped++; continue; }
      }
      if (fs.existsSync(path.join(ROOT, ref))) continue;
      // A bare dir reference is fine if the dir exists.
      if (fs.existsSync(path.join(ROOT, path.dirname(ref)))) {
        const base = path.basename(ref);
        if (!/\.[a-z]+$/.test(base)) continue;                    // not file-like
      }
      bad.push(`${path.relative(ROOT, doc)}:${n + 1}: \`${ref}\` does not exist`);
    }
  });
}

if (bad.length) {
  console.error(`\ncheck-links: FAIL — ${bad.length} stale reference(s):\n`);
  for (const b of bad) console.error(`  ✗ ${b}`);
  console.error(`\nFix the path, or delete the claim. A doc that cites a missing file\nteaches the next agent a procedure it cannot perform.\n`);
  process.exit(1);
}
const notes = [];
if (historical) notes.push(`${historical} marked HISTORICAL RECORD`);
if (corpusSkipped) {
  notes.push(`${corpusSkipped} corpus path(s) UNCHECKED — no pipeline/corpus; run bash pipeline/run.sh to verify them`);
}
console.log(
  `check-links: OK — ${DOCS.length - historical} live docs, every cited path resolves` +
  (notes.length ? ` (${notes.join('; ')}).` : '.'),
);
