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
  ["#/loops", ["Loops", "Runs", "Templates", "Settings", "Triage digest", 'role="switch"', "New loop", 'aria-current="page"', "Demo data"], ["Not found", "T-701"]],
  ["#/settings/inference", ["Connect inference", "API key", "Probe models", "Environment offline"], ["Not found", "T-802"]],
  // T-1104: the runs routes mount the live containers — SSR shows the demo
  // fallback (fixtures + the demo note), never the old placeholders.
  ["#/loop/abc/runs", ["Triage digest", "SUP-214", "Demo data"], ["Not found", "T-703"]],
  ["#/loop/abc/run/r9", ["Standup scribe", "Answer the loop", "Demo data"], ["Not found", "T-703", "runId: r9"]],
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
