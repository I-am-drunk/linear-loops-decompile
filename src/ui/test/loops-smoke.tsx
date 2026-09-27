/**
 * T-701 render smokes for the loops list page (renderToString; bundled with
 * esbuild by run-smoke.mjs). Covers: grouped render, status chips, exactly
 * one role="switch" per row, both empty states, style emit.
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { LoopsListPage, LoopsStyles, demoLoops } from "../src/features/loops/index.ts";

const noop = (): void => {};
let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`${name}: ${(e as Error).message}`);
  }
}

const base = {
  loops: demoLoops,
  inferenceConfigured: true,
  onToggle: noop,
  onOpen: noop,
  onNewLoop: noop,
  onOpenInferenceSettings: noop,
} as const;

check("groups render A→Z with Workspace last", () => {
  const html = renderToString(<LoopsListPage {...base} />);
  const support = html.indexOf("Support");
  const eng = html.indexOf("Eng");
  const workspace = html.indexOf("Workspace");
  assert.ok(support !== -1 && eng !== -1 && workspace !== -1, "all three groups render");
  assert.ok(eng < support && support < workspace, "Eng < Support < Workspace ordering");
  for (const name of ["Triage digest", "SLA watch", "Standup scribe", "Release notes drafter", "Mention helper"]) {
    assert.ok(html.includes(name), `renders ${name}`);
  }
  assert.ok(html.includes("Daily"), "schedule labels render");
  assert.ok(html.includes("Issue in triage"), "event trigger label renders");
  assert.ok(html.includes("Chat mention"), "chat trigger label renders");
});

check("status chips + one switch per row", () => {
  const html = renderToString(<LoopsListPage {...base} />);
  assert.ok(html.includes("ll-chip-success"), "complete chip tone");
  assert.ok(html.includes("ll-chip-danger"), "error chip tone");
  assert.ok(html.includes("ll-chip-warning"), "awaitingInput chip tone");
  assert.ok(html.includes("ll-chip-muted"), "never-run chip tone");
  const switches = html.match(/role="switch"/g) ?? [];
  assert.equal(switches.length, demoLoops.length, "one role=switch per row");
  assert.ok(html.includes('aria-checked="true"'), "enabled loop renders on");
  assert.ok(html.includes('aria-checked="false"'), "disabled loop renders off");
});

check("empty state: inference not configured", () => {
  const html = renderToString(<LoopsListPage {...base} inferenceConfigured={false} />);
  assert.ok(html.includes("Connect your AI to run loops"));
  assert.ok(html.includes("Connect inference"));
  assert.ok(!html.includes("Triage digest"), "no rows behind the gate");
});

check("empty state: configured, zero loops", () => {
  const html = renderToString(<LoopsListPage {...base} loops={[]} />);
  assert.ok(html.includes("No loops yet"));
  assert.ok(html.includes("New loop"));
});

check("styles emit and reference theme tokens", () => {
  const html = renderToString(<LoopsStyles />);
  assert.ok(html.includes(".ll-row"), "row class emitted");
  assert.ok(html.includes("var(--accent)"), "theme tokens referenced, no second palette");
});

if (failures > 0) {
  console.error(`loops-smoke: ${failures} assertion group(s) failed`);
  process.exit(1);
}
console.log("loops-smoke: all render assertions passed");
