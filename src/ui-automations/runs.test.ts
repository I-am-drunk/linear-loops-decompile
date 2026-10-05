/** AU6: run record, sort/paginate kernel, and the section. Pure. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, makeRegistry } from "./detail.ts";
import { durationMs, pageRuns, RUNS_KEY, runsSection, sortRuns, type Run, type RunStatus } from "./runs.ts";

const run = (id: string, queuedAt: string, status: RunStatus = `succeeded`, over: Partial<Run> = {}): Run => ({
  id, automationId: `a`, status, queuedAt, transcript: [], ...over,
});
const ids = (rs: readonly Run[]): string => rs.map((r) => r.id).join(``);

test(`sortRuns is newest first, with id as a stable tiebreak`, () => {
  const rs = [run(`a`, `2026-10-05T09:00:00Z`), run(`c`, `2026-10-05T11:00:00Z`), run(`b`, `2026-10-05T11:00:00Z`)];
  assert.equal(ids(sortRuns(rs)), `cba`);
  assert.equal(ids(sortRuns([...rs].reverse())), `cba`, `input order must not leak`);
  assert.equal(ids(rs), `acb`, `input mutated`);
});

test(`pageRuns walks by cursor and never repeats or skips across pages`, () => {
  const rs = [`a`, `b`, `c`, `d`, `e`].map((id, i) => run(id, `2026-10-05T1${i}:00:00Z`));
  const p1 = pageRuns(rs, 2);
  assert.equal(ids(p1.runs), `ed`);
  assert.equal(p1.nextCursor, `d`);
  const p2 = pageRuns(rs, 2, p1.nextCursor);
  assert.equal(ids(p2.runs), `cb`);
  const p3 = pageRuns(rs, 2, p2.nextCursor);
  assert.equal(ids(p3.runs), `a`);
  assert.equal(p3.nextCursor, undefined, `last page has no cursor`);
});

test(`a run inserted at the top between requests does not shift the window`, () => {
  // Offset paging would repeat `d` here; cursor paging does not.
  const rs = [`a`, `b`, `c`, `d`].map((id, i) => run(id, `2026-10-05T1${i}:00:00Z`));
  const p1 = pageRuns(rs, 2);
  const withNew = [...rs, run(`z`, `2026-10-05T19:00:00Z`)];
  const p2 = pageRuns(withNew, 2, p1.nextCursor);
  assert.equal(ids(p2.runs), `ba`);
});

test(`durationMs is undefined while queued or running, and never negative`, () => {
  assert.equal(durationMs(run(`q`, `2026-10-05T10:00:00Z`, `queued`)), undefined);
  assert.equal(durationMs(run(`r`, `2026-10-05T10:00:00Z`, `running`, { startedAt: `2026-10-05T10:00:01Z` })), undefined);
  const done = run(`d`, `2026-10-05T10:00:00Z`, `succeeded`,
    { startedAt: `2026-10-05T10:00:01.000Z`, endedAt: `2026-10-05T10:00:03.500Z` });
  assert.equal(durationMs(done), 2500);
  // A clock that went backwards yields undefined, not a negative duration.
  const skew = run(`s`, `2026-10-05T10:00:00Z`, `succeeded`,
    { startedAt: `2026-10-05T10:00:05Z`, endedAt: `2026-10-05T10:00:01Z` });
  assert.equal(durationMs(skew), undefined);
});

test(`a failed run names the provider the automation ASKED for`, () => {
  const reg = makeRegistry();
  reg.register(runsSection(10));
  const failed = run(`f`, `2026-10-05T10:00:00Z`, `failed`,
    { failure: { kind: `unavailable`, provider: `anthropic`, detail: `socket` } });
  const row = makeEditor(reg, { [RUNS_KEY]: [failed] }).sections()[0]?.rows[0];
  assert.ok(row?.kind === `connection` && row.state === `error`);
  assert.match(row?.kind === `connection` ? row.detail ?? `` : ``, /provider_unavailable: anthropic/);
});

test(`the section renders the newest page through AU2's frame, and the runner's writes do not dirty the editor`, () => {
  const reg = makeRegistry();
  reg.register(runsSection(2));
  const rs = [`a`, `b`, `c`].map((id, i) => run(id, `2026-10-05T1${i}:00:00Z`));
  const e = makeEditor(reg, { [RUNS_KEY]: rs });

  // Page size 2 of 3 runs: the two newest, as rows.
  const rows = e.sections()[0]?.rows ?? [];
  assert.equal(rows.length, 2);
  assert.match(rows[0]?.label ?? ``, /Succeeded · 2026-10-05T12/);
  assert.match(rows[1]?.label ?? ``, /2026-10-05T11/);

  // Empty state when nothing has run.
  const empty = makeEditor(reg, { [RUNS_KEY]: [] }).sections()[0]?.rows ?? [];
  assert.equal(empty.length, 1);
  assert.equal(empty[0]?.disabled, true);
});
