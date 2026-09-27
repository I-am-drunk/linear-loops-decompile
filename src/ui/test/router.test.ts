import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isSettingsRoute,
  navSectionOf,
  normalizeHash,
  parseHash,
  routeToPath,
} from "../src/router.ts";
import type { Route } from "../src/router.ts";

test("root resolves to the loops list", () => {
  assert.deepEqual(parseHash(""), { name: "loops" });
  assert.deepEqual(parseHash("#"), { name: "loops" });
  assert.deepEqual(parseHash("#/"), { name: "loops" });
});

test("static routes parse", () => {
  assert.deepEqual(parseHash("#/loops"), { name: "loops" });
  assert.deepEqual(parseHash("#/loops/new"), { name: "loop-new" });
  assert.deepEqual(parseHash("#/templates"), { name: "templates" });
  assert.deepEqual(parseHash("#/settings"), { name: "settings" });
  assert.deepEqual(parseHash("#/settings/linear"), { name: "settings-linear" });
  assert.deepEqual(parseHash("#/settings/inference"), { name: "settings-inference" });
  assert.deepEqual(parseHash("#/settings/environment"), { name: "settings-environment" });
});

test("parameterized routes parse + decode", () => {
  assert.deepEqual(parseHash("#/loop/abc123"), { name: "loop-detail", loopId: "abc123" });
  assert.deepEqual(parseHash("#/loop/abc123/runs"), { name: "loop-runs", loopId: "abc123" });
  assert.deepEqual(parseHash("#/loop/abc123/run/r42"), {
    name: "run-detail",
    loopId: "abc123",
    runId: "r42",
  });
  assert.deepEqual(parseHash("#/loop/my%20loop"), { name: "loop-detail", loopId: "my loop" });
});

test("unknown paths are a first-class not-found, never a crash", () => {
  assert.deepEqual(parseHash("#/nope"), { name: "not-found", path: "/nope" });
  assert.deepEqual(parseHash("#/loop"), { name: "not-found", path: "/loop" });
  assert.deepEqual(parseHash("#/loop/x/run"), { name: "not-found", path: "/loop/x/run" });
});

test("trailing slashes and missing hash prefix normalize", () => {
  assert.deepEqual(normalizeHash("#/loops/"), "/loops");
  assert.deepEqual(normalizeHash("/settings/linear/"), "/settings/linear");
  assert.deepEqual(parseHash("/loops"), { name: "loops" });
});

test("every concrete route round-trips through routeToPath -> parseHash", () => {
  const routes: ReadonlyArray<Exclude<Route, { name: "not-found" }>> = [
    { name: "loops" },
    { name: "loop-new" },
    { name: "loop-detail", loopId: "L1" },
    { name: "loop-runs", loopId: "L1" },
    { name: "run-detail", loopId: "L1", runId: "R9" },
    { name: "templates" },
    { name: "settings" },
    { name: "settings-linear" },
    { name: "settings-inference" },
    { name: "settings-environment" },
  ];
  for (const r of routes) {
    assert.deepEqual(parseHash(routeToPath(r)), r, `round-trip ${r.name}`);
  }
});

test("nav sections: loop pages -> loops, run pages stay loops-family, settings family groups", () => {
  assert.equal(navSectionOf("loops"), "loops");
  assert.equal(navSectionOf("loop-detail"), "loops");
  assert.equal(navSectionOf("run-detail"), "loops");
  assert.equal(navSectionOf("templates"), "templates");
  assert.equal(navSectionOf("settings-inference"), "settings");
  assert.equal(navSectionOf("not-found"), "none");
  assert.ok(isSettingsRoute("settings-linear"));
  assert.ok(!isSettingsRoute("loops"));
});

