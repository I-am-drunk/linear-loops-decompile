/**
 * T-703 render smokes (renderToString; esbuild-bundled by run-smoke.mjs):
 * list filter behavior, cancel visibility by status, live pulse, follow-up
 * box copy states, activity stream kinds.
 */
import assert from "node:assert/strict";
import type { JSX, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import {
  ActivityStream,
  FollowUpBox,
  RunDetailPage,
  RunsListPage,
  RunsStyles,
  demoRunDetail,
  demoRunDetailDone,
  demoRunDetailLive,
  demoRuns,
} from "../src/features/loops/runs/index.ts";
import { LoopsStyles } from "../src/features/loops/index.ts";
import { LoopEditorStyles } from "../src/features/loops/editor/index.ts";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`${name}: ${(e as Error).message}`);
  }
}
const noop = (): void => {};
const noopSend = (_id: string, _text: string): void => {};
const Shell = (props: { readonly children: ReactNode }): JSX.Element => (
  <>
    <LoopEditorStyles />
    <LoopsStyles />
    <RunsStyles />
    {props.children}
  </>
);

check("runs list: rows, chips, filter segmented control", () => {
  const html = renderToString(<Shell><RunsListPage runs={demoRuns} onOpenRun={noop} /></Shell>);
  for (const needle of ["Standup scribe", "Triage digest", "SLA watch", "SUP-214", "Failed", "Waiting for input", "$0.0042", "41s"]) {
    assert.ok(html.includes(needle), `renders ${needle}`);
  }
  assert.ok(html.includes('aria-label="Filter runs"'), "filter control renders");
  assert.ok((html.match(/lr-dot/g) ?? []).length >= demoRuns.length, "one status dot per row");
});

check("run detail: cancel visible while live, hidden when terminal", () => {
  const live = renderToString(<Shell><RunDetailPage run={demoRunDetailLive} onCancel={noop} onSend={noopSend} /></Shell>);
  assert.ok(live.includes("Cancel run"), "live run shows cancel");
  assert.ok(live.includes("live"), "live pulse marker");
  const done = renderToString(<Shell><RunDetailPage run={demoRunDetailDone} onCancel={noop} onSend={noopSend} /></Shell>);
  assert.ok(!done.includes("Cancel run"), "terminal run hides cancel");
});

check("run detail: usage line + summary + stream kinds", () => {
  const html = renderToString(<Shell><RunDetailPage run={demoRunDetail} onCancel={noop} onSend={noopSend} /></Shell>);
  for (const needle of ["1.2k in · 340 out · $0.0031", "Drafting the standup summary", "Thought", "Action", "Loop", "Question", "Post", "Edit first"]) {
    assert.ok(html.includes(needle), `renders ${needle}`);
  }
  assert.ok(html.includes("Answer the loop…"), "awaitingInput follow-up copy");
  assert.ok(html.includes("Send answer"), "awaitingInput button copy");
});

check("follow-up copy states", () => {
  assert.ok(renderToString(<FollowUpBox status="active" onSend={noop} />).includes("Steer this run…"));
  assert.ok(renderToString(<FollowUpBox status="complete" onSend={noop} />).includes("Continue"));
});

check("stream: live tail only while live; empty state without", () => {
  const live = renderToString(<ActivityStream activities={[]} live={true} />);
  assert.ok(live.includes('aria-label="streaming"'), "live tail renders");
  const empty = renderToString(<ActivityStream activities={[]} live={false} />);
  assert.ok(empty.includes("No activity recorded"), "empty stream copy");
  assert.ok(!empty.includes("streaming"), "no tail when not live");
});

if (failures > 0) {
  console.error(`loops-runs-smoke: ${failures} assertion group(s) failed`);
  process.exit(1);
}
console.log("loops-runs-smoke: all render assertions passed");
