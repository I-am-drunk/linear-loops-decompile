/** AU5: per-automation tool references, resolved live. Pure; no client. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, makeRegistry } from "./detail.ts";
import { addTool, removeTool, setAllowed, setApproval, TOOLS_KEY, toolsOf, toolsSection } from "./tools.ts";
import { makeMcpRegistry } from "../mcp/registry.ts";
import type { AutomationTool, McpServer } from "../mcp/types.ts";

const srv = (id: string, over: Partial<McpServer> = {}): McpServer => ({
  id, name: id, scope: `workspace`, enabled: true, auth: { kind: `none` },
  transport: { kind: `http`, url: `https://${id}.example/` }, ...over,
});
const ref = (serverId: string, over: Partial<AutomationTool> = {}): AutomationTool => ({
  automationId: `a`, serverId, allowedTools: [], approval: `auto`, ...over,
});

test(`one reference per server — a second attach of the same serverId is refused`, () => {
  const one = addTool([], ref(`gh`));
  assert.ok(one.ok);
  const dup = one.ok ? addTool(one.tools, ref(`gh`, { allowedTools: `all` })) : one;
  // Two allowlists for one connection; the runner would have no rule for which wins.
  assert.equal(dup.ok === false && dup.detail, `server gh is already attached`);
});

test(`addTool and removeTool return NEW lists and leave the input alone`, () => {
  const start: AutomationTool[] = [ref(`a`)];
  const added = addTool(start, ref(`b`));
  assert.ok(added.ok && added.tools.length === 2);
  assert.equal(start.length, 1, `input mutated`);
  assert.deepEqual(removeTool(added.ok ? added.tools : [], `a`).map((t) => t.serverId), [`b`]);
});

test(`setAllowed replaces one server's list; "all" is a deliberate widening`, () => {
  const l = [ref(`a`), ref(`b`)];
  const out = setAllowed(l, `a`, [`issues.list`, `issues.create`]);
  assert.deepEqual(out[0]?.allowedTools, [`issues.list`, `issues.create`]);
  assert.deepEqual(out[1]?.allowedTools, [], `other servers untouched`);
  assert.equal(setAllowed(l, `a`, `all`)[0]?.allowedTools, `all`);
  assert.deepEqual(l[0]?.allowedTools, [], `input mutated`);
});

test(`setApproval flips one server between auto and ask`, () => {
  const l = [ref(`a`), ref(`b`)];
  const out = setApproval(l, `b`, `ask`);
  assert.equal(out[0]?.approval, `auto`);
  assert.equal(out[1]?.approval, `ask`);
});

test(`toolsOf tolerates a missing or malformed key`, () => {
  assert.deepEqual(toolsOf({}), []);
  assert.deepEqual(toolsOf({ [TOOLS_KEY]: 42 }), []);
});

test(`the section resolves each reference live; a missing server degrades VISIBLY`, () => {
  const mcp = makeMcpRegistry();
  mcp.register(srv(`gh`, { name: `GitHub` }));
  const reg = makeRegistry();
  reg.register(toolsSection(mcp));
  const e = makeEditor(reg, { [TOOLS_KEY]: [] });

  // Empty: one disabled explanatory row.
  assert.equal(e.sections()[0]?.rows.length, 1);
  assert.equal(e.sections()[0]?.rows[0]?.disabled, true);

  // One known server with a 1-tool allowlist and ask: connection + toggle.
  e.set(TOOLS_KEY, [ref(`gh`, { allowedTools: [`issues.list`], approval: `ask` })]);
  const rows = e.sections()[0]?.rows ?? [];
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.label, `GitHub`);
  assert.equal(rows[0]?.kind === `connection` && rows[0].detail, `1 of this server's tools`);
  assert.equal(rows[1]?.kind === `toggle` && rows[1].on, true);

  // Add a reference to a server this workspace lacks: it must render as
  // missing with a next step, not vanish. This is the state the plan calls
  // easiest to forget.
  const next = addTool(toolsOf(e.draft()), ref(`ghost`, { allowedTools: `all` }));
  assert.ok(next.ok);
  if (next.ok) e.set(TOOLS_KEY, next.tools);
  const all = e.sections()[0]?.rows ?? [];
  assert.equal(all.length, 3, `2 for GitHub + 1 missing row`);
  const missing = all[2];
  assert.equal(missing?.label, `ghost`);
  assert.ok(missing?.kind === `connection` && missing.state === `error`);
  assert.match(missing?.kind === `connection` ? missing.detail ?? `` : ``, /set up, or pick another/);
  assert.deepEqual(e.dirtySections(), [`tools`]);
});
