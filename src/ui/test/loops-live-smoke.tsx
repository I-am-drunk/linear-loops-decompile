/**
 * T-1104 render smokes (renderToString; esbuild-bundled by run-smoke.mjs):
 *  - containers render the fixture demo fallback (SSR: effects never run),
 *  - the demo/live status note renders,
 *  - live-mapped view models (wire DTOs → mappers) render through the real
 *    T-701/T-703 pages untouched.
 * Effect paths (load/poll/subscribe) are covered by live-wire.test.ts's
 * protocol-parity test against the real ChannelServer.
 */
import assert from "node:assert/strict";
import type { JSX, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import {
  LiveStyles,
  LoopsListLive,
  RunDetailLive,
  RunsListLive,
  loopsViewOf,
  runDetailOf,
} from "../src/live/index.ts";
import { LoopsStyles, LoopsListPage } from "../src/features/loops/index.ts";
import { RunDetailPage, RunsStyles } from "../src/features/loops/runs/index.ts";
import type { LoopDto } from "../src/live/wire.ts";
import type { Run, Turn } from "../../runtime/types.ts";

let failures = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
  } catch (e) {
    failures++;
    console.error(`${name}: ${(e as Error).message}`);
  }
}

const Shell = (props: { readonly children: ReactNode }): JSX.Element => (
  <>
    <LiveStyles />
    <LoopsStyles />
    <RunsStyles />
    {props.children}
  </>
);

// A live loop/run as the wire DTOs would carry them.
const liveLoop: LoopDto = {
  id: "sla-watch",
  name: "SLA watch",
  enabled: true,
  version: 12,
  createdAt: "2026-09-20T00:00:00.000Z",
  updatedAt: "2026-09-27T05:00:00.000Z",
  config: {
    name: "SLA watch",
    groupName: "Workspace",
    description: "Pings when SLAs slip",
    icon: "⏱️",
    color: "#eb5757",
    prompt: { format: "markdown", markdown: "Watch SLAs." },
    trigger: { type: "event", event: { entity: "issue", kind: "updated" }, activationMode: "watchedPropertyChanged" },
    conditions: [],
    enabled: true,
    applyToSubTeams: false,
    activities: ["comment"],
    trustedSourceKeys: [],
    codeAccess: "none",
    editAccess: "organization",
    subscriberIds: [],
  },
};
const liveRun: Run = {
  id: "run-live-1",
  loopId: "sla-watch",
  status: "complete",
  iteration: 42,
  createdAt: "2026-09-27T05:59:00.000Z",
  startedAt: "2026-09-27T05:59:00.000Z",
  endedAt: "2026-09-27T05:59:12.000Z",
  summary: "No SLAs at risk.",
  usage: { inputTokens: 900, outputTokens: 80, costUsd: 0.0011 },
  target: { entity: "issue", id: "x", label: "SUP-201" },
};
const liveTurns: Turn[] = [
  {
    id: "turn-1",
    runId: "run-live-1",
    position: 0,
    role: "agent",
    status: "complete",
    startedAt: "2026-09-27T05:59:01.000Z",
    parts: [
      { kind: "thought", text: "Two issues near their SLA." },
      { kind: "response", text: "No SLAs at risk." },
    ],
  },
];
const NOW = new Date("2026-09-27T06:00:00.000Z");

check("containers: demo fallback renders fixtures + the demo note (SSR, no effects)", () => {
  const list = renderToString(<Shell><LoopsListLive source={null} /></Shell>);
  assert.ok(list.includes("Demo data"), "demo note renders");
  assert.ok(list.length > 200, "loops list page renders");

  const runs = renderToString(<Shell><RunsListLive source={null} loopId="all" /></Shell>);
  assert.ok(runs.includes("Standup scribe"), "fixture runs render");
  assert.ok(runs.includes("Demo data"), "demo note renders");

  const detail = renderToString(<Shell><RunDetailLive source={null} loopId="standup-scribe" runId="run-8" /></Shell>);
  assert.ok(detail.includes("Standup scribe"), "fixture run detail renders");
  assert.ok(detail.includes("Answer the loop"), "follow-up box renders");
});

check("live models: loopsViewOf output renders through the untouched T-701 page", () => {
  const loops = loopsViewOf([liveLoop], [liveRun], NOW);
  assert.equal(loops[0]?.lastRun?.status, "complete");
  assert.equal(loops[0]?.ownerName, "You");
  const html = renderToString(
    <Shell>
      <LoopsListPage
        loops={loops}
        inferenceConfigured={true}
        onToggle={() => {}}
        onOpen={() => {}}
        onNewLoop={() => {}}
        onOpenInferenceSettings={() => {}}
      />
    </Shell>,
  );
  // The row shows name + the "trigger · owner" sub-line (description is a
  // detail-page field; the mapping itself is unit-tested in live-wire).
  for (const needle of ["SLA watch", "You"]) {
    assert.ok(html.includes(needle), `renders ${needle}`);
  }
});

check("live models: runDetailOf output renders through the untouched T-703 detail page", () => {
  const detail = runDetailOf(liveRun, liveTurns, "SLA watch", NOW);
  assert.deepEqual(detail.activities.map((a) => a.kind), ["thought", "response"]);
  const html = renderToString(
    <Shell>
      <RunDetailPage run={detail} onCancel={() => {}} onSend={() => {}} />
    </Shell>,
  );
  for (const needle of ["SLA watch", "SUP-201", "No SLAs at risk.", "Two issues near their SLA.", "Complete", "Continue"]) {
    assert.ok(html.includes(needle), `renders ${needle}`);
  }
});

if (failures > 0) {
  console.error(`loops-live-smoke: ${failures} check(s) failed`);
  process.exit(1);
}
console.log("loops-live-smoke: all render assertions passed");
