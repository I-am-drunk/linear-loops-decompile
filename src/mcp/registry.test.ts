/** MCP1: registry + resolution order. Pure; no transport. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeMcpRegistry } from "./registry.ts";
import type { McpServer } from "./types.ts";

const srv = (id: string, name: string, over: Partial<McpServer> = {}): McpServer => ({
  id, name, scope: `workspace`, enabled: true, auth: { kind: `none` },
  transport: { kind: `http`, url: `https://${id}.example.com/` }, ...over,
});

test(`register refuses a forbidden destination and does NOT store it`, () => {
  const r = makeMcpRegistry();
  const v = r.register(srv(`meta`, `Meta`, { transport: { kind: `http`, url: `https://169.254.169.254/` } }));
  assert.equal(v.ok, false);
  assert.equal(r.get(`meta`), undefined, `a refused server must not be retrievable`);
  assert.deepEqual(r.list(), []);
});

test(`stdio servers skip the destination check — they are gated by role, not range`, () => {
  const r = makeMcpRegistry();
  const v = r.register(srv(`fs`, `Filesystem`, { transport: { kind: `stdio`, command: `mcp-fs`, args: [] } }));
  assert.deepEqual(v, { ok: true });
  assert.ok(r.get(`fs`));
});

test(`double registration throws rather than replacing silently`, () => {
  const r = makeMcpRegistry();
  r.register(srv(`a`, `A`));
  assert.throws(() => r.register(srv(`a`, `A2`)), /already registered: a/);
});

test(`list() sorts by name, case-insensitively`, () => {
  const r = makeMcpRegistry();
  r.register(srv(`z`, `zeta`));
  r.register(srv(`a`, `Alpha`));
  r.register(srv(`b`, `beta`));
  assert.deepEqual(r.list().map((s) => s.name), [`Alpha`, `beta`, `zeta`]);
});

test(`resolve: explicit serverId wins over everything`, () => {
  const r = makeMcpRegistry();
  r.register(srv(`gh-ws`, `GitHub`, { scope: `workspace` }));
  r.register(srv(`gh-me`, `GitHub`, { scope: `user` }));
  const got = r.resolve({ serverId: `gh-me`, name: `GitHub`, scope: `workspace` });
  assert.ok(got.found && got.server.id === `gh-me`);
});

test(`resolve: exact name in the requested scope, then any scope`, () => {
  const r = makeMcpRegistry();
  r.register(srv(`gh-ws`, `GitHub`, { scope: `workspace` }));
  r.register(srv(`gh-me`, `GitHub`, { scope: `user` }));
  const inScope = r.resolve({ name: `GitHub`, scope: `user` });
  assert.ok(inScope.found && inScope.server.id === `gh-me`);
  // Asking for a scope that has no match falls through to any scope.
  const r2 = makeMcpRegistry();
  r2.register(srv(`gh-ws`, `GitHub`, { scope: `workspace` }));
  const fallback = r2.resolve({ name: `GitHub`, scope: `user` });
  assert.ok(fallback.found && fallback.server.id === `gh-ws`);
});

test(`resolve: name matching is case-insensitive`, () => {
  const r = makeMcpRegistry();
  r.register(srv(`gh`, `GitHub`));
  assert.ok(r.resolve({ name: `github` }).found);
  assert.ok(r.resolve({ name: `GITHUB` }).found);
});

test(`resolve: an unknown reference is a tagged "missing", never undefined`, () => {
  // An automation is portable (duplicate, copy-as-JSON, import), so it will
  // routinely name a server this workspace lacks. undefined is how
  // "silently run tool-less" starts; a tagged result has to be handled.
  const r = makeMcpRegistry();
  const byId = r.resolve({ serverId: `ghost` });
  assert.deepEqual(byId, { found: false, wanted: `ghost` });
  const byName = r.resolve({ name: `Nope` });
  assert.deepEqual(byName, { found: false, wanted: `Nope` });
  assert.deepEqual(r.resolve({}), { found: false, wanted: `` });
});
