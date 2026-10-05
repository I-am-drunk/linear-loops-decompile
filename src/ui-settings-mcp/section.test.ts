/** ST5: server-to-rows mapping and the five-state fold. Pure; no client. */

import assert from "node:assert/strict";
import { test } from "node:test";
import { mcpPage, rowsForServer, sectionsFor, type ServerView } from "./section.ts";
import type { McpServer, McpStatus } from "../mcp/types.ts";

const srv = (id: string, over: Partial<McpServer> = {}): McpServer => ({
  id, name: id, scope: `workspace`, enabled: true, auth: { kind: `none` },
  transport: { kind: `http`, url: `https://${id}.example/` }, ...over,
});

const view = (server: McpServer, status: McpStatus): ServerView => ({ server, status });
const conn = (v: ServerView) => {
  const r = rowsForServer(v)[0];
  return r?.kind === `connection` ? r : undefined;
};

test(`the plan's five states fold onto ST2's four badges with disambiguating detail`, () => {
  const s = srv(`a`);
  const at = (st: McpStatus) => conn(view(s, st));

  const ok = at({ state: `connected`, tools: [`x`, `y`] });
  assert.equal(ok?.state, `connected`);
  assert.equal(ok?.detail, `2 tools`);

  assert.equal(at({ state: `disconnected` })?.state, `disconnected`);
  assert.match(at({ state: `disconnected` })?.detail ?? ``, /retry/);

  // needsAuth and missing share the error badge but tell the user different
  // next steps — that is the point of the detail text.
  const auth = at({ state: `needsAuth` });
  assert.equal(auth?.state, `error`);
  assert.match(auth?.detail ?? ``, /connect/);

  const gone = at({ state: `missing`, wanted: `a` });
  assert.equal(gone?.state, `error`);
  assert.match(gone?.detail ?? ``, /set up, or pick another/);

  assert.equal(at({ state: `error`, detail: `handshake failed` })?.detail, `handshake failed`);
});

test(`bearer and header auth get a credential row; none and oauth2 do not`, () => {
  const kinds = (auth: McpServer[`auth`]) =>
    rowsForServer(view(srv(`a`, { auth }), { state: `disconnected` })).map((r) => r.kind);
  assert.deepEqual(kinds({ kind: `bearer` }), [`connection`, `text`, `credential`]);
  assert.deepEqual(kinds({ kind: `header`, name: `x-key` }), [`connection`, `text`, `credential`]);
  assert.deepEqual(kinds({ kind: `none` }), [`connection`, `text`]);
  assert.deepEqual(kinds({ kind: `oauth2`, scopes: [] }), [`connection`, `text`]);
});

test(`the header credential is labelled with its header name`, () => {
  const rows = rowsForServer(view(srv(`a`, { auth: { kind: `header`, name: `x-api-key` } }), { state: `needsAuth` }));
  const cred = rows.find((r) => r.kind === `credential`);
  assert.ok(cred?.kind === `credential`);
  if (cred?.kind === `credential`) {
    assert.equal(cred.label, `Header x-api-key`);
    assert.equal(cred.configured, false, `needsAuth means the credential is not configured`);
    assert.ok(!(`value` in cred), `a credential row carries no value`);
  }
});

test(`transport is shown read-only, stdio as its command and http as its url`, () => {
  const io = rowsForServer(view(srv(`fs`, { transport: { kind: `stdio`, command: `mcp-fs`, args: [] } }), { state: `disconnected` }))[1];
  assert.ok(io?.kind === `text` && io.value === `stdio · mcp-fs` && io.disabled === true);
  const web = rowsForServer(view(srv(`gh`), { state: `disconnected` }))[1];
  assert.ok(web?.kind === `text` && web.value === `http · https://gh.example/`);
});

test(`sections sort by name case-insensitively, and the blurb states scope and enablement`, () => {
  const out = sectionsFor([
    view(srv(`z`, { name: `zeta`, scope: `user`, enabled: false }), { state: `disconnected` }),
    view(srv(`a`, { name: `Alpha` }), { state: `disconnected` }),
  ]);
  assert.deepEqual(out.map((s) => s.title), [`Alpha`, `zeta`]);
  assert.equal(out[0]?.blurb, `Shared · enabled`);
  assert.equal(out[1]?.blurb, `Private · disabled`);
});

test(`mcpPage is shaped for the settings shell`, () => {
  const page = mcpPage([view(srv(`a`), { state: `disconnected` })]);
  assert.equal(page.id, `mcp`);
  assert.equal(page.title, `MCP servers`);
  assert.equal(page.sections.length, 1);
});
