/**
 * T-805 container smokes (renderToString; esbuild-bundled by run-smoke.mjs):
 * the EditorContainer's fixture first paint is byte-identical to the
 * DemoEditor it replaced — the pre-T-805 shell smoke expectations hold.
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { EditorContainer } from "../src/live/index.ts";
import { FixtureLoopsSource } from "../src/live/sources.ts";

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

if (failures > 0) {
  console.error(`live-editor-smoke: ${failures} assertion group(s) failed`);
  process.exit(1);
}
console.log("live-editor-smoke: all render assertions passed");
