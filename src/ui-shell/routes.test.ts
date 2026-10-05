import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ROUTES,
  DEFAULT_PATH,
  sections,
  routesIn,
  matchRoute,
} from "./routes.ts";

test("sections are first-appearance ordered, not alphabetical", () => {
  assert.deepEqual(sections(), ["Workspace", "Settings"]);
});

test("every route lands in a section that sections() reports", () => {
  const known = new Set(sections());
  for (const r of ROUTES) assert.ok(known.has(r.section), r.section);
});

test("every section is non-empty — an empty header renders as a stray label", () => {
  for (const s of sections()) assert.ok(routesIn(s).length > 0, s);
});

test("the default path resolves to a real route", () => {
  assert.ok(matchRoute(DEFAULT_PATH), DEFAULT_PATH);
});

test("Automations sorts above Integrations — owner decision 10", () => {
  const paths = ROUTES.map((r) => r.path);
  assert.ok(
    paths.indexOf("/automations") < paths.indexOf("/settings/integrations"),
  );
});

test("a sub-path keeps its parent highlighted", () => {
  assert.equal(
    matchRoute("/settings/inference/advanced")?.label,
    "Inference",
  );
});

test("longest prefix wins, not declaration order", () => {
  const routes = [
    { path: "/settings", label: "Settings", section: "S" },
    { path: "/settings/mcp", label: "MCP", section: "S" },
  ];
  assert.equal(matchRoute("/settings/mcp", routes)?.label, "MCP");
});

test("a prefix must end at a segment boundary", () => {
  assert.equal(matchRoute("/runs-archive"), null);
});

test("an unknown path matches nothing — the caller redirects", () => {
  assert.equal(matchRoute("/nope"), null);
  assert.equal(matchRoute(""), null);
});

test("paths are unique", () => {
  const paths = ROUTES.map((r) => r.path);
  assert.equal(paths.length, new Set(paths).size);
});
