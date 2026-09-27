#!/usr/bin/env node
/**
 * swarm land-bot — turns a `/land` issue comment into a branch commit (+ PR).
 * Spec: COORDINATION.md §5. Zero-dep, Node >= 20, runs in GitHub Actions.
 *
 * Command (first line starting with `/land`):
 *   /land branch=<name> [from=#<n>[,#<n>…]] [pr="<title>"] [base=<branch>]
 *
 * FILE blocks: `### FILE: <path>` followed by a fenced code block (3+ backticks,
 * optional language tag; closing fence = same length).
 *
 * Apply order (later wins per path): for each issue in `from=` (in the order
 * given): body, then comments oldest→newest; finally the /land comment's own
 * blocks (so inline corrections always win).
 *
 * Policy: never main/master; branch names agent-*|swarm-*|docs-*|fix-*|test-*;
 * path allowlist src/ work/ docs/ SPECS/ extracts/ pipeline/ ci/ and root *.md;
 * .github/** is never written (lead-only). Caps: 512KB/file, 2MB/bundle.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
const comment = event.comment?.body ?? '';
const issueNumber = event.issue?.number;
const repo = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN;

const sh = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts }).trim();
const gh = (args) => sh('gh', args, { env: { ...process.env, GH_TOKEN: token } });

function say(body) {
  gh(['issue', 'comment', String(issueNumber), '--repo', repo, '--body', body]);
}
function fail(msg) {
  say(`❌ **land-bot:** ${msg}`);
  console.error(msg);
  process.exit(1);
}

// --- 1. command line ---------------------------------------------------------
const landLine = comment.split('\n').map((l) => l.trim()).find((l) => l.startsWith('/land'));
if (!landLine) {
  console.log('no /land command in this comment; ignoring');
  process.exit(0);
}
const args = {};
for (const m of landLine.matchAll(/(\w+)=(("[^"]*")|\S+)/g)) {
  args[m[1]] = m[2].startsWith('"') ? m[2].slice(1, -1) : m[2];
}
const branch = args.branch;
if (!branch) fail('missing `branch=<name>`');
if (branch === 'main' || branch === 'master') {
  fail('the bot never commits to main — land on a branch and merge via PR');
}
if (!/^(agent|swarm|docs|fix|test)-?[\w.-]*\/[\w./-]+$/.test(branch) || branch.includes('..') || branch.endsWith('/')) {
  fail(`branch name rejected: \`${branch}\` (expected e.g. \`agent-NN/tNNN-slug\`)`);
}
const base = args.base || 'main';
const fromIssues = args.from ? args.from.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean) : [];

// --- 2. FILE-block extraction ------------------------------------------------
function extractFiles(text) {
  const out = [];
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].trim().match(/^#{1,4}\s*FILE:\s*(\S+)(?:\s+\([^)]*\))?\s*$/);
    if (!h) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    const f = j < lines.length ? lines[j].trim().match(/^(`{3,})([\w+-]*)\s*$/) : null;
    if (!f) continue;
    const fence = f[1];
    const buf = [];
    let k = j + 1;
    while (k < lines.length && lines[k].trim() !== fence) { buf.push(lines[k]); k++; }
    if (k >= lines.length) continue; // unterminated fence — skip
    out.push([h[1], buf.join('\n') + '\n']);
    i = k;
  }
  return out;
}

// --- 3. collect sources ------------------------------------------------------
const files = new Map(); // path -> { content, origin }
function absorb(text, origin) {
  for (const [p, c] of extractFiles(text)) files.set(p, { content: c, origin });
}
for (const n of fromIssues) {
  let issue;
  try {
    issue = JSON.parse(gh(['api', `repos/${repo}/issues/${n}`]));
  } catch {
    fail(`could not read issue #${n}`);
  }
  absorb(issue.body, `#${n} body`);
  let page = 1;
  for (;;) {
    const pageItems = JSON.parse(
      gh(['api', `repos/${repo}/issues/${n}/comments?per_page=100&page=${page}`])
    );
    for (const c of pageItems) absorb(c.body, `#${n} comment ${c.id}`);
    if (pageItems.length < 100) break;
    page++;
  }
}
absorb(comment, 'the /land comment');
if (files.size === 0) {
  fail('no FILE blocks found (format: `### FILE: <path>` then a fenced code block)');
}

// --- 4. validate paths -------------------------------------------------------
const ALLOW = /^(src\/|work\/|docs\/|SPECS\/|extracts\/|pipeline\/|ci\/|[^/\\]+\.md$)/;
let total = 0;
for (const [p, f] of files) {
  if (p.startsWith('/') || p.includes('..') || p.includes('\\')) fail(`path rejected: \`${p}\``);
  if (p.startsWith('.github/')) fail(`path rejected: \`${p}\` — .github/** is lead-only (COORDINATION.md §8)`);
  if (!ALLOW.test(p)) fail(`path outside the allowlist: \`${p}\` (allowed: src/ work/ docs/ SPECS/ extracts/ pipeline/ ci/ root *.md)`);
  if (f.content.length > 512 * 1024) fail(`file too large (>512KB): \`${p}\``);
  total += f.content.length;
}
if (total > 2 * 1024 * 1024) fail('bundle too large (>2MB) — split it across several /land comments onto the same branch');

// --- 5. git ------------------------------------------------------------------
sh('git', ['fetch', 'origin', base]);
let exists = true;
try { sh('git', ['rev-parse', '--verify', `origin/${branch}`]); } catch { exists = false; }
if (exists) {
  sh('git', ['fetch', 'origin', branch]);
  sh('git', ['checkout', '-B', branch, `origin/${branch}`]);
} else {
  sh('git', ['checkout', '-B', branch, `origin/${base}`]);
}
for (const [p, f] of files) {
  mkdirSync(dirname(p) === '.' ? '.' : dirname(p), { recursive: true });
  writeFileSync(p, f.content);
}
sh('git', ['add', '--', ...files.keys()]);
let changed = true;
try { sh('git', ['diff', '--cached', '--quiet']); changed = false; } catch { changed = true; }
if (!changed) {
  say(`ℹ️ **land-bot:** all ${files.size} file(s) already match \`${branch}\` — no-op.`);
  process.exit(0);
}
sh('git', ['config', 'user.name', 'github-actions[bot]']);
sh('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
const title = args.pr || `apply ${files.size} FILE block(s)`;
const srcDesc = fromIssues.length ? fromIssues.map((n) => `#${n}`).join(' ') : `comment on #${issueNumber}`;
sh('git', ['commit', '-m',
  `${title}\n\nlanded by swarm land-bot from ${srcDesc} (command: issue #${issueNumber})\n\nfiles:\n${[...files.keys()].map((p) => `- ${p}`).join('\n')}`]);
try {
  sh('git', ['push', '-u', 'origin', branch]);
} catch {
  sh('git', ['pull', '--rebase', 'origin', branch]);
  sh('git', ['push', '-u', 'origin', branch]);
}
const sha = sh('git', ['rev-parse', 'HEAD']).slice(0, 7);

// --- 6. PR --------------------------------------------------------------------
let prUrl = '';
if (args.pr) {
  const existing = JSON.parse(gh(['pr', 'list', '--repo', repo, '--head', branch, '--state', 'open', '--json', 'url']));
  if (existing.length) {
    prUrl = existing[0].url;
  } else {
    const body = [
      `Landed by the **swarm land-bot** from ${srcDesc}.`,
      '',
      ...[...files.entries()].map(([p, f]) => `- \`${p}\` — ${f.content.split('\n').length - 1} lines ← ${f.origin}`),
      '',
      'Review per COORDINATION.md §4 (buddy review with reproduced `bash ci/check-src.sh` evidence), then merge via `github.merge_pull_request` (squash).',
      'Note: bot pushes do not trigger CI (GitHub does not cascade GITHUB_TOKEN events); the merge to main runs it.',
    ].join('\n');
    prUrl = gh(['pr', 'create', '--repo', repo, '--base', base, '--head', branch, '--title', title, '--body', body]);
  }
}

// --- 7. report -----------------------------------------------------------------
say([
  `✅ **land-bot:** committed ${files.size} file(s) to \`${branch}\` @ \`${sha}\``,
  '',
  ...[...files.entries()].map(([p, f]) => `- \`${p}\` ← ${f.origin}`),
  '',
  prUrl ? `PR: ${prUrl}` : '(no pr="…" given — no PR opened)',
].join('\n'));
console.log(`landed ${files.size} files on ${branch} @ ${sha} ${prUrl}`);
