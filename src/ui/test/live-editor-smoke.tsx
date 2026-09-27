/**
 * T-805 container smokes (renderToString; esbuild-bundled by run-smoke.mjs):
 * the EditorContainer's fixture first paint matches the DemoEditor it
 * replaced on every marker the pre-T-805 shell smoke asserts — and under a
 * live source the demo draft is never rendered (loading state instead).
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { EditorContainer } from "../src/live/index.ts";
import { FixtureLoopsSource, LiveLoopsSource, type ChannelRpc } from "../src/live/sources.ts";

/** Live-kind source over a request that never resolves (effects don't run
 *  under renderToString — only the source's kind matters here). */
const pendingRpc: ChannelRpc = {
  request: () => new Promise(() => {}),
  onEvent: undefined,
  onStateChange: undefined,
  unsubscribe: () => {},
};

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`${name}: ${(e as Error).message}`);
  }
}

check("loop-detail paint: demo config in published state, no alert", () => {
  const html = renderToString(<EditorContainer loopId="standup-scribe" source={new FixtureLoopsSource()} />);
  assert.ok(html.includes("Standup scribe"), "fixture loop name renders");
  assert.ok(html.includes("v3"), "published version renders");
  assert.ok(html.includes("Danger zone"), "danger zone renders");
  assert.ok(!html.includes('role="alert"'), "no error note on first paint");
});

check("loop-new paint: blank draft, not-published hint, no alert", () => {
  const html = renderToString(<EditorContainer loopId={null} source={new FixtureLoopsSource()} />);
  assert.ok(html.includes("New loop — not published yet"), "new-loop hint renders");
  assert.ok(html.includes("Identity"), "identity block renders");
  assert.ok(html.includes("Danger zone"), "danger zone renders");
  assert.ok(!html.includes('role="alert"'), "no error note on first paint");
});

check("live source, record not yet loaded: loading state, never demo data", () => {
  const html = renderToString(<EditorContainer loopId="loop-42" source={new LiveLoopsSource(pendingRpc)} />);
  assert.ok(html.includes("Loading loop loop-42"), "loading state names the loop");
  assert.ok(!html.includes("Standup scribe"), "demo draft is never publishable under a live source");
  assert.ok(!html.includes("Publish"), "no publish control while unloaded");
});

if (failures > 0) {
  console.error(`live-editor-smoke: ${failures} assertion group(s) failed`);
  process.exit(1);
}
console.log("live-editor-smoke: all render assertions passed");
