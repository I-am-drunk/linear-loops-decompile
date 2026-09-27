/**
 * Shell smoke test: renders <App/> to string for several routes and asserts the
 * sidebar, active nav state, and page content all appear. Bundled with esbuild
 * (see run-smoke.mjs) because Node's type stripping does not transform JSX.
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { App } from "../src/App.tsx";

// useHashRoute reads window.location.hash — stub a minimal window for SSR.
function withHash(hash: string, fn: () => void): void {
  (globalThis as Record<string, unknown>)["window"] = {
    location: { hash },
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  try {
    fn();
  } finally {
    delete (globalThis as Record<string, unknown>)["window"];
  }
}

const routes: ReadonlyArray<readonly [string, string[], string[]]> = [
  // [hash, mustContain, mustNotContain]
  ["#/loops", ["Loops", "Runs", "Templates", "Settings", "Triage digest", 'role="switch"', "New loop", 'aria-current="page"'], ["Not found", "T-701"]],
  ["#/loops/new", ["New loop — not published yet", "Identity", "Trigger", "Danger zone"], ["Not found", "T-702"]],
  ["#/loop/abc", ["Standup scribe", "v3", "Danger zone"], ["Not found", "T-702"]],
  ["#/templates", ["Templates", "T-704"], ["Not found", "T-702"]],
  ["#/settings/inference", ["Connect inference", "API key", "Probe models", "Environment offline"], ["Not found", "T-802"]],
  // T-1104: runs routes render live containers. SSR/first paint = fixture
  // data (peek), then effects swap live data in a configured browser. An
  // unknown run shows the loading state (fixture miss → fetch).
  ["#/loop/abc/run/r9", ["Loading run r9"], ["Not found", "T-703"]],
  ["#/loop/abc/runs", ["No runs"], ["Not found", "T-703"]],
  ["#/loop/all/runs", ["SUP-214", "Triage digest"], ["Not found", "No runs"]],
  ["#/loop/abc/run/run-7", ["Triage digest", "SUP-214"], ["Not found", "Loading run"]],
  ["#/bogus", ["Page not found", "/bogus"], ["T-701"]],
];

let failures = 0;
for (const [hash, must, mustNot] of routes) {
  withHash(hash, () => {
    const html = renderToString(<App workspaceName="Acme" envStatus="offline" />);
    for (const needle of must) {
      try {
        assert.ok(html.includes(needle), `#${hash} should contain ${JSON.stringify(needle)}`);
      } catch (e) {
        failures++;
        console.error((e as Error).message);
      }
    }
    for (const needle of mustNot) {
      try {
        assert.ok(!html.includes(needle), `#${hash} should NOT contain ${JSON.stringify(needle)}`);
      } catch (e) {
        failures++;
        console.error((e as Error).message);
      }
    }
  });
}

if (failures > 0) {
  console.error(`smoke: ${failures} assertion(s) failed`);
  process.exit(1);
}
console.log(`smoke: ${routes.length} routes rendered, all assertions passed`);
