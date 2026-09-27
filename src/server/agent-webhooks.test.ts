/**
 * Tests for the T-605 AgentSessionEvent inbound webhooks: signature gate,
 * created → run start, prompted → steer, replay dedupe, and the
 * 200-and-skip discipline. All seams are fixtures — no network, no creds.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

import { openDatabase } from "./db.ts";
import { Store } from "./store.ts";
import {
  createAgentWebhookHandler,
  readAgentSessionEvent,
  readRunForSession,
  verifyLinearSignature,
  type AgentRunCommands,
} from "./agent-webhooks.ts";

const SECRET = "whsec_test_signing_secret";

function sign(secret: string, raw: Buffer): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

// ---- fake req/res ------------------------------------------------------------

function fakeReq(method: string, raw: Buffer, headers: Record<string, string>): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage & EventEmitter;
  emitter.method = method;
  emitter.headers = headers;
  process.nextTick(() => {
    emitter.emit("data", raw);
    emitter.emit("end");
  });
  return emitter;
}

interface FakeRes {
  status: number | null;
  body: string;
  headersSent: boolean;
  writeHead(status: number, headers?: Record<string, string>): void;
  end(chunk?: string): void;
  finished: Promise<void>;
}

function fakeRes(): FakeRes {
  let resolveFinished!: () => void;
  const finished = new Promise<void>((r) => {
    resolveFinished = r;
  });
  const res: FakeRes = {
    status: null,
    body: "",
    headersSent: false,
    writeHead(status) {
      res.status = status;
      res.headersSent = true;
    },
    end(chunk) {
      if (chunk !== undefined) res.body += chunk;
      resolveFinished();
    },
    finished,
  };
  return res;
}

// ---- fixtures -----------------------------------------------------------------

interface StartedRun {
  loopId: string;
  triggerEventId: string;
  target: { entityType: string; entityId: string };
}

function fixtureCommands(): {
  commands: AgentRunCommands;
  started: StartedRun[];
  steered: { runId: string; text: string }[];
  nextRunId: string;
} {
  const started: StartedRun[] = [];
  const steered: { runId: string; text: string }[] = [];
  const state = { nextRunId: "run_1" };
  return {
    started,
    steered,
    get nextRunId() {
      return state.nextRunId;
    },
    commands: {
      requestRun: (req) => {
        started.push({
          loopId: req.loopId,
          triggerEventId: req.triggerEventId,
          target: req.target,
        });
        const runId = state.nextRunId;
        state.nextRunId = `run_${Number(runId.split("_")[1]) + 1}`;
        return Promise.resolve({ runId });
      },
      steerRun: (runId, text) => {
        steered.push({ runId, text });
      },
    },
  };
}

function depsFor(overrides: {
  secret?: string | null;
  loopId?: string | null;
  commands?: AgentRunCommands;
  store?: Store;
}): { handler: ReturnType<typeof createAgentWebhookHandler>; store: Store } {
  const store = overrides.store ?? new Store(openDatabase(":memory:"));
  return {
    store,
    handler: createAgentWebhookHandler({
      secrets: { getSigningSecret: () => (overrides.secret === undefined ? SECRET : overrides.secret) },
      inboundLoop: { getInboundLoopId: () => (overrides.loopId === undefined ? "loop-inbound" : overrides.loopId) },
      commands: overrides.commands ?? fixtureCommands().commands,
      store,
    }),
  };
}

const CREATED_PAYLOAD = {
  action: "created",
  type: "AgentSessionEvent",
  data: {
    agentSession: {
      id: "sess_linear_1",
      issue: { id: "LIN-42" },
      promptContext: "Issue LIN-42: Triage me.\n\nComments: …\n\nGuidance: be terse.",
    },
  },
};

function post(
  handler: ReturnType<typeof createAgentWebhookHandler>,
  payload: unknown,
  opts: { secret?: string | null; delivery?: string; rawOverride?: Buffer } = {},
): Promise<FakeRes> {
  const raw = opts.rawOverride ?? Buffer.from(JSON.stringify(payload));
  const secret = opts.secret === undefined ? SECRET : opts.secret;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret !== null) headers["linear-signature"] = sign(secret, raw);
  if (opts.delivery !== undefined) headers["linear-delivery"] = opts.delivery;
  const res = fakeRes();
  handler(fakeReq("POST", raw, headers), res as unknown as ServerResponse);
  return res.finished.then(() => res);
}

// ---- signature gate -----------------------------------------------------------

test("verifyLinearSignature: good passes, bad/tampered/missing fails in constant time", () => {
  const raw = Buffer.from('{"a":1}');
  const good = sign(SECRET, raw);
  assert.equal(verifyLinearSignature(SECRET, raw, good), true);
  assert.equal(verifyLinearSignature(SECRET, raw, sign(SECRET, Buffer.from('{"a":2}'))), false);
  assert.equal(verifyLinearSignature(SECRET, raw, undefined), false);
  assert.equal(verifyLinearSignature(SECRET, raw, "not-hex"), false);
  assert.equal(verifyLinearSignature("other-secret", raw, good), false);
});

test("no signing secret configured → 503, never accepts traffic", async () => {
  const { handler } = depsFor({ secret: null });
  const res = await post(handler, CREATED_PAYLOAD, { secret: null });
  assert.equal(res.status, 503);
});

test("bad signature → 401, no run, no audit", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });
  const res = await post(handler, CREATED_PAYLOAD, { secret: "wrong-secret" });
  assert.equal(res.status, 401);
  assert.equal(fx.started.length, 0);
  assert.equal(store.listAudit({}).length, 0);
});

test("GET → 405", async () => {
  const { handler } = depsFor({});
  const res = fakeRes();
  handler(fakeReq("GET", Buffer.from(""), {}), res as unknown as ServerResponse);
  await res.finished;
  assert.equal(res.status, 405);
});

// ---- created ------------------------------------------------------------------

test("created → starts a run on the inbound loop with Linear's promptContext + issue target", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });

  const res = await post(handler, CREATED_PAYLOAD, { delivery: "del_1" });
  assert.equal(res.status, 200);
  assert.equal(fx.started.length, 1);
  assert.equal(fx.started[0]!.loopId, "loop-inbound");
  assert.equal(fx.started[0]!.triggerEventId, "agentSession:sess_linear_1");
  assert.deepEqual(fx.started[0]!.target, { entityType: "issue", entityId: "LIN-42" });

  // The session↔run mapping landed on the audit rail.
  assert.equal(readRunForSession(store, "sess_linear_1"), "run_1");
});

test("created replay (same Linear-Delivery id) → 200, never a second run", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });

  await post(handler, CREATED_PAYLOAD, { delivery: "del_dup" });
  const res2 = await post(handler, CREATED_PAYLOAD, { delivery: "del_dup" });
  assert.equal(res2.status, 200);
  assert.equal(fx.started.length, 1);
});

test("created with no inbound loop configured → 200-and-skip with an audit reason", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store, loopId: null });

  const res = await post(handler, CREATED_PAYLOAD, { delivery: "del_2" });
  assert.equal(res.status, 200);
  assert.equal(fx.started.length, 0);
  const skips = store
    .listAudit({})
    .map((row) => JSON.parse(String(row["detail_json"])))
    .filter((d) => d["skipped"] === true);
  assert.equal(skips.length, 1);
  assert.match(String(skips[0]!["reason"]), /no inbound loop configured/);
});

test("created without promptContext falls back to guidance + issue ref", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });
  const payload = {
    action: "created",
    data: { agentSession: { id: "sess_2", issue: { id: "LIN-7" }, guidance: "be terse" } },
  };
  const res = await post(handler, payload, { delivery: "del_3" });
  assert.equal(res.status, 200);
  assert.equal(fx.started.length, 1);
  // Message assembled from the fallbacks (no promptContext present).
  assert.equal(fx.started[0]!.target.entityId, "LIN-7");
});

// ---- prompted -----------------------------------------------------------------

test("prompted → steers the mapped run with the user's message", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });

  await post(handler, CREATED_PAYLOAD, { delivery: "del_c" });
  const prompted = {
    action: "prompted",
    data: {
      agentSession: { id: "sess_linear_1" },
      agentActivity: { body: "actually, label it bug" },
    },
  };
  const res = await post(handler, prompted, { delivery: "del_p" });
  assert.equal(res.status, 200);
  assert.deepEqual(fx.steered, [{ runId: "run_1", text: "actually, label it bug" }]);
});

test("prompted on an unmapped session → 200-and-skip, no steer", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });
  const prompted = {
    action: "prompted",
    data: { agentSession: { id: "sess_unknown" }, agentActivity: { body: "hello?" } },
  };
  const res = await post(handler, prompted, { delivery: "del_q" });
  assert.equal(res.status, 200);
  assert.equal(fx.steered.length, 0);
});

// ---- defensive parsing ---------------------------------------------------------

test("readAgentSessionEvent: malformed and drifted shapes", () => {
  assert.equal(readAgentSessionEvent(null), null);
  assert.equal(readAgentSessionEvent({ action: "created" }), null); // no session id
  const nested = readAgentSessionEvent({
    action: "prompted",
    data: { agentSession: { id: "s" }, agentActivity: { body: "hi" } },
  });
  assert.deepEqual(nested, {
    action: "prompted",
    sessionId: "s",
    issueId: undefined,
    promptContext: undefined,
    promptBody: "hi",
    guidance: undefined,
  });
  // Flat shape (no data wrapper) also reads.
  const flat = readAgentSessionEvent({ action: "created", id: "s2", issue: { id: "I-1" } });
  assert.equal(flat?.sessionId, "s2");
  assert.equal(flat?.issueId, "I-1");
});

test("malformed JSON with a valid signature → 200-and-skip (never a retry storm)", async () => {
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ commands: fx.commands, store });
  const res = await post(handler, null, { rawOverride: Buffer.from("{not json") });
  assert.equal(res.status, 200);
  assert.equal(fx.started.length, 0);
});

test("unknown action → 200-and-skip", async () => {
  const store = new Store(openDatabase(":memory:"));
  const { handler } = depsFor({ store });
  const res = await post(handler, { action: "refreshed", data: { agentSession: { id: "s9" } } }, { delivery: "del_z" });
  assert.equal(res.status, 200);
  const skips = store
    .listAudit({})
    .map((row) => JSON.parse(String(row["detail_json"])))
    .filter((d) => d["skipped"] === true);
  assert.equal(skips.length, 1);
  assert.match(String(skips[0]!["reason"]), /unhandled action: refreshed/);
});

// ---- http.ts mount (the caller-passed-handler route) -------------------------

test("mounted on the real http server: signed created over the wire → 200 + run started", async () => {
  const { createHttpServer } = await import("./http.ts");
  const fx = fixtureCommands();
  const store = new Store(openDatabase(":memory:"));
  const server = createHttpServer({
    agentWebhookHandler: createAgentWebhookHandler({
      secrets: { getSigningSecret: () => SECRET },
      inboundLoop: { getInboundLoopId: () => "loop-inbound" },
      commands: fx.commands,
      store,
    }),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const raw = Buffer.from(JSON.stringify(CREATED_PAYLOAD));
    const res = await fetch(`http://127.0.0.1:${port}/webhooks/linear-agent`, {
      method: "POST",
      headers: { "content-type": "application/json", "linear-signature": sign(SECRET, raw), "linear-delivery": "del_http" },
      body: raw,
    });
    assert.equal(res.status, 200);
    assert.equal(fx.started.length, 1);
    assert.equal(readRunForSession(store, "sess_linear_1"), "run_1");

    // Unmounted paths still 404 through the same server.
    const nope = await fetch(`http://127.0.0.1:${port}/webhooks/other`, { method: "POST" });
    assert.equal(nope.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
