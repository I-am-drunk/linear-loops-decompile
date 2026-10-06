#!/usr/bin/env node
// Read the live GitHub queue through the authenticated CLI. No GitHub writes.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

const execute = promisify(execFile);
const DEFAULT_REPO = 'I-am-drunk/linear-loops-decompile';
const cell = (value) => String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
const link = (item) => '[#' + item.number + '](' + item.url + ')';

export function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--feedback') options.feedback = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--help') options.help = true;
    else if (arg === '--repo' && args[index + 1] && !args[index + 1].startsWith('--')) options.repo = args[++index];
    else throw new Error('Unknown or incomplete option: ' + arg);
  }
  return options;
}

export function renderBoard(board) {
  const lines = [
    '# Live board: ' + board.repo, '', 'Read from GitHub at ' + board.readAt + '.', '',
    '| Oldest PR first | Title | Base / open parent | Head | Feedback C/R/I |',
    '|---|---|---|---|---|',
  ];
  for (const pr of board.pullRequests) {
    const counts = board.feedback ? [pr.comments.length, pr.reviews.length, pr.inline.length].join('/') : 'not fetched';
    const base = pr.parent ? '#' + pr.parent + ' (' + cell(pr.base) + ')' : cell(pr.base);
    lines.push('| ' + link(pr) + ' | ' + cell(pr.title) + (pr.draft ? ' (draft)' : '') + ' | ' + base + ' | ' + pr.sha.slice(0, 8) + ' | ' + counts + ' |');
  }
  if (!board.pullRequests.length) lines.push('No open PRs.');
  lines.push('', 'C/R/I = issue comments / formal reviews / inline comments, including bots.',
    'Counts are not approval or resolution. Read the linked discussions before claiming or merging.',
    'A non-main base with no open parent needs its ancestry checked.', '');
  lines.push('| Open issue | Title | Labels |', '|---|---|---|');
  for (const issue of board.issues) {
    lines.push('| ' + link(issue) + ' | ' + cell(issue.title) + ' | ' + issue.labels.map(cell).join(', ') + ' |');
  }
  lines.push('', 'Lane tails (last three comments; full bodies in --json):', '');
  for (const lane of board.lanes) {
    lines.push(link(lane) + ' ' + cell(lane.title));
    for (const comment of lane.comments.slice(-3)) {
      const body = cell(comment.body);
      lines.push('- [' + comment.created_at + '](' + comment.html_url + ') ' + body.slice(0, 240) + (body.length > 240 ? ' …' : ''));
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

export function parsePages(text) {
  const pages = JSON.parse(text);
  if (!Array.isArray(pages) || !pages.every(Array.isArray)) {
    throw new Error('Expected paginated GitHub arrays; refusing an incomplete board');
  }
  return pages.flat();
}

export async function githubPages(endpoint, run = execute) {
  const { stdout } = await run('gh', ['api', '--paginate', '--slurp', endpoint], {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  return parsePages(stdout);
}

async function mapLimited(items, visit) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(4, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await visit(items[index]);
    }
  });
  const settled = await Promise.allSettled(workers);
  const failed = settled.find((result) => result.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}

export async function loadBoard({ repo = DEFAULT_REPO, feedback = false, api = githubPages } = {}) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository must be owner/name');
  const root = 'repos/' + repo;
  const pulls = await api(root + '/pulls?state=open&sort=created&direction=asc&per_page=100');
  const issues = (await api(root + '/issues?state=open&sort=created&direction=asc&per_page=100'))
    .filter((issue) => !issue.pull_request);
  const parents = new Map(pulls.map((pr) => [pr.head.ref, pr.number]));
  pulls.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.number - b.number);
  const pullRequests = await mapLimited(pulls, async (pr) => {
    const result = {
      number: pr.number, title: pr.title, url: pr.html_url, draft: pr.draft,
      createdAt: pr.created_at, updatedAt: pr.updated_at,
      base: pr.base.ref, head: pr.head.ref, sha: pr.head.sha,
      parent: parents.get(pr.base.ref) ?? null,
    };
    if (feedback) {
      result.comments = await api(root + '/issues/' + pr.number + '/comments?per_page=100');
      result.reviews = await api(root + '/pulls/' + pr.number + '/reviews?per_page=100');
      result.inline = await api(root + '/pulls/' + pr.number + '/comments?per_page=100');
    }
    return result;
  });
  const lanes = await mapLimited(issues.filter((issue) => issue.labels.some((label) =>
    (typeof label === 'string' ? label : label.name).startsWith('lane:'))), async (issue) => ({
      number: issue.number, title: issue.title, url: issue.html_url,
      comments: await api(root + '/issues/' + issue.number + '/comments?per_page=100'),
    }));
  return {
    repo, readAt: new Date().toISOString(), feedback, pullRequests, lanes,
    issues: issues.map((issue) => ({
      number: issue.number, title: issue.title, url: issue.html_url,
      labels: issue.labels.map((label) => typeof label === 'string' ? label : label.name),
    })),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log('Usage: node tools/board/main.mjs [--feedback] [--json] [--repo owner/name]');
      console.log('Read-only: fetch all pages of open PRs, issues and lane comments.');
      console.log('--feedback also fetches every PR issue comment, review and inline comment.');
    } else {
      const board = await loadBoard(options);
      process.stdout.write(options.json ? JSON.stringify(board, null, 2) + '\n' : renderBoard(board));
    }
  } catch (error) {
    console.error('board: ' + error.message);
    process.exitCode = 1;
  }
}
