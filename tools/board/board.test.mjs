import test from 'node:test';
import assert from 'node:assert/strict';
import { githubPages, loadBoard, parseArgs, parsePages, renderBoard } from './main.mjs';

test('GitHub CLI pagination keeps later pages and never accepts an error object', async () => {
  const values = await githubPages('repos/o/r/issues?per_page=100', async (command, args) => {
    assert.equal(command, 'gh');
    assert.deepEqual(args, ['api', '--paginate', '--jq', '@json', 'repos/o/r/issues?per_page=100']);
    return { stdout: JSON.stringify(Array.from({ length: 100 }, (_, i) => i)) + '\n' + JSON.stringify([100, 101]) };
  });
  assert.equal(values.length, 102);
  assert.equal(values.at(-1), 101);
  assert.throws(() => parsePages('{"message":"rate limited"}'), /incomplete board/);
  assert.throws(() => parsePages('[]\n{"message":"bad page"}'), /incomplete board/);
  await assert.rejects(githubPages('x', async () => { throw new Error('auth failed'); }), /auth failed/);
});

function pull(number, base, date) {
  return { number, title: 'PR ' + number, html_url: 'https://example.com/' + number,
    created_at: date, updated_at: date, draft: false,
    head: { ref: 'branch-' + number, sha: 'abc12345', repo: { full_name: 'o/r' } },
    base: { ref: base, repo: { full_name: 'o/r' } } };
}

function fixture() {
  const calls = [];
  const api = async (endpoint) => {
    calls.push(endpoint);
    if (endpoint.includes('/pulls?')) return [pull(12, 'branch-11', '2026-10-02'), pull(11, 'main', '2026-10-01')];
    if (endpoint.includes('/issues?')) return [
      { number: 1, title: 'Lane', html_url: 'https://example.com/1', labels: [{ name: 'lane:shell' }] },
      { number: 12, title: 'Pull', labels: [], pull_request: {} },
    ];
    if (endpoint.endsWith('/issues/1/comments?per_page=100')) return Array.from({ length: 105 }, (_, i) => ({
      id: i, body: 'claim ' + i, created_at: '2026-10-06', html_url: 'https://example.com/comment/' + i,
    }));
    if (/\/(issues|pulls)\/(11|12)\/(comments|reviews)\?per_page=100$/.test(endpoint)) return [{ body: 'feedback' }];
    throw new Error('Unexpected endpoint ' + endpoint);
  };
  return { calls, api };
}

test('board orders old PRs first, resolves parents, and retains all feedback and lane comments', async () => {
  const { api, calls } = fixture();
  const board = await loadBoard({ repo: 'o/r', api, feedback: true });
  assert.deepEqual(board.pullRequests.map((pr) => [pr.number, pr.parent]), [[11, null], [12, 11]]);
  assert.deepEqual(board.issues.map((issue) => issue.number), [1]);
  assert.equal(board.lanes[0].comments.length, 105);
  for (const type of ['comments', 'reviews', 'inline']) assert.equal(board.pullRequests[0][type].length, 1);
  assert.equal(calls.length, 9);
  const text = renderBoard(board);
  assert.ok(text.indexOf('[#11]') < text.indexOf('[#12]'));
  assert.match(text, /claim 104/);
  assert.match(text, /Counts are not approval/);
});

test('a failed inline-feedback request fails the entire read', async () => {
  const { api } = fixture();
  await assert.rejects(loadBoard({ repo: 'o/r', feedback: true, api: (path) => {
    if (path.includes('/pulls/12/comments')) throw new Error('API unavailable');
    return api(path);
  } }), /API unavailable/);
});

test('default mode labels unfetched feedback and validates CLI options', async () => {
  const { api, calls } = fixture();
  const board = await loadBoard({ repo: 'o/r', api });
  assert.equal(calls.length, 3);
  assert.match(renderBoard(board), /not fetched/);
  assert.deepEqual(parseArgs(['--repo', 'o/r', '--feedback', '--json']), { repo: 'o/r', feedback: true, json: true });
  assert.throws(() => parseArgs(['--repo']), /incomplete/);
  assert.throws(() => parseArgs(['--typo']), /Unknown/);
  await assert.rejects(loadBoard({ repo: '../oops/extra', api }), /owner\/name/);
});

test('fork parents and ambiguous branches cannot invent a stack', async () => {
  const { api } = fixture();
  const fork = pull(11, 'main', '2026-10-01');
  fork.head = { ref: 'main', sha: 'abc12345', repo: { full_name: 'contributor/r' } };
  const deleted = pull(14, 'main', '2026-10-01');
  deleted.head.repo = null;
  const duplicate = pull(16, 'release', '2026-10-01');
  duplicate.head.ref = 'branch-12';
  const pulls = [fork, pull(12, 'main', '2026-10-01'), pull(13, 'branch-12', '2026-10-01'), deleted, duplicate];
  const board = await loadBoard({ repo: 'o/r', api: (path) => path.includes('/pulls?') ? pulls : api(path) });
  assert.equal(board.pullRequests.find((pr) => pr.number === 11).parent, null);
  assert.equal(board.pullRequests.find((pr) => pr.number === 12).parent, null);
  const child = board.pullRequests.find((pr) => pr.number === 13);
  assert.equal(child.parent, null);
  assert.deepEqual(child.parentCandidates, [12, 16]);
  assert.match(renderBoard(board), /ambiguous: #12, #16/);
});
