/**
 * T-1104 container smokes (renderToString; esbuild-bundled by run-smoke.mjs).
 * Fixture-injected containers render synchronously via the sources' peek
 * seam — what this pins is that all three mount and render offline data
 * without an effect turn. Live-source loading states and the full data flow
 * are covered in live-mappers/live-sources (node --test).
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import {
  FixtureLoopsSource,
  FixtureRunsSource,
  LoopsListContainer,
  RunsListContainer,
  RunDetailContainer,
} from "../src/live/index.ts";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`${name}: ${(e as Error).message}`);
  }
}

check("loops list container renders fixture rows on first paint", () => {
  const html = renderToString(<LoopsListContainer source={new FixtureLoopsSource()} />);
  assert.ok(html.includes("Triage digest"), "fixture loop name visible");
  assert.ok(html.includes('role="switch"'), "one switch per row");
});

check("runs list container renders fixture runs on first paint", () => {
  const html = renderToString(<RunsListContainer loopId="all" source={new FixtureRunsSource()} />);
  assert.ok(html.includes("SUP-214"), "fixture run target visible");
});

check("run detail container renders a known fixture run", () => {
  const html = renderToString(<RunDetailContainer loopId="standup-scribe" runId="run-8" source={new FixtureRunsSource()} />);
  assert.ok(html.includes("Standup scribe"), "fixture detail visible");
});

check("run detail container shows the loading state for an unknown run", () => {
  const html = renderToString(<RunDetailContainer loopId="l1" runId="nope" source={new FixtureRunsSource()} />);
  assert.ok(html.includes("Loading run nope"), "loading state names the run");
});

if (failures > 0) {
  console.error(`live-smoke: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("live-smoke: all render assertions passed");
