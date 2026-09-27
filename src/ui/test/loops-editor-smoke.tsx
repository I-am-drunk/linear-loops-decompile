/**
 * T-702 render smokes for the loop editor (renderToString; bundled with
 * esbuild by run-smoke.mjs): blocks render, publish gating names the first
 * issue, raw RRULEs are preserved, weekly day chips render.
 */
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import { DemoEditor } from "../src/features/loops/editor/index.ts";
import { defaultLoopConfig } from "../../model/index.ts";
import type { LoopConfig } from "../../model/index.ts";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`${name}: ${(e as Error).message}`);
  }
}

check("all blocks render on a valid draft; publish is enabled", () => {
  const html = renderToString(<DemoEditor publishedVersion={3} />);
  for (const block of ["Identity", "Scope", "Trigger", "Conditions", "Prompt", "Capabilities", "Danger zone"]) {
    assert.ok(html.includes(block), `renders ${block}`);
  }
  assert.ok(html.includes("Standup scribe"), "fixture name renders");
  assert.ok(html.includes("v3"), "published version renders");
  assert.ok(html.includes("FREQ=WEEKLY"), "the rrule is visible");
  assert.ok(!html.includes("Publish…"), "not stuck publishing");
  assert.ok(!/disabled=""[^>]*>\s*Publish/.test(html), "publish not disabled on valid draft");
});

check("invalid draft: publish disabled + first issue named", () => {
  const bad: LoopConfig = { ...defaultLoopConfig(), name: "  " };
  const html = renderToString(<DemoEditor initial={bad} />);
  assert.ok(html.includes("Name is required"), "names the reason");
  assert.ok(/disabled=""[^>]*>\s*Publish/.test(html), "publish disabled");
});

check("watchedPropertyChanged without watchedProperties gates publish", () => {
  const bad: LoopConfig = {
    ...defaultLoopConfig(),
    trigger: {
      type: "event",
      event: { entity: "issue", kind: "updated" },
      activationMode: "watchedPropertyChanged",
    },
  };
  const html = renderToString(<DemoEditor initial={bad} />);
  assert.ok(html.includes("needs at least one watchedProperties condition"));
});

check("raw rrule is preserved byte-identical and labeled", () => {
  const raw: LoopConfig = {
    ...defaultLoopConfig(),
    trigger: { type: "schedule", schedule: { rrule: "FREQ=WEEKLY;BYDAY=MO;BYSETPOS=1", timezone: "UTC" } },
  };
  const html = renderToString(<DemoEditor initial={raw} />);
  assert.ok(html.includes("FREQ=WEEKLY;BYDAY=MO;BYSETPOS=1"), "raw rule renders untouched");
  assert.ok(html.includes("kept exactly as written"), "raw-mode hint renders");
});

check("weekly builder renders day chips; new-loop flow renders", () => {
  const html = renderToString(<DemoEditor initial={defaultLoopConfig()} />);
  assert.ok(html.includes("New loop — not published yet"));
  // switch the fixture to weekly to see the chips
  const weekly: LoopConfig = {
    ...defaultLoopConfig(),
    trigger: { type: "schedule", schedule: { rrule: "FREQ=WEEKLY;BYDAY=MO", timezone: "UTC" } },
  };
  const wh = renderToString(<DemoEditor initial={weekly} />);
  for (const d of ["Mon", "Fri", "Sun"]) assert.ok(wh.includes(d), `${d} chip renders`);
});

if (failures > 0) {
  console.error(`loops-editor-smoke: ${failures} assertion group(s) failed`);
  process.exit(1);
}
console.log("loops-editor-smoke: all render assertions passed");
