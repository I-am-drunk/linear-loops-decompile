/**
 * Tests for the server skeleton: store rails (zod validation, idempotency,
 * append-only audit, secret-key refusal), runtime persistence + boot
 * restore, and the HTTP surface (health, static, traversal guard, descriptor
 * mount). Real node:http round-trips on ephemeral ports; node:sqlite
 * :memory:. Zero-dep.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { defaultLoopConfig } from "../model/loop-config.ts";
import { ScriptBrain } from "../runtime/brain.ts";
import { openDatabase } from "./db.ts";
import { Store, StoreValidationError } from "./store.ts";
import { persistRun } from "./persistence.ts";
import { createLoopsServer } from "./index.ts";
import { Runner } from "../runtime/runner.ts";

function deps() {
  let tick = 0;
  let id = 0;
  return {
    now: () => new Date(Date.UTC(2026, 8, 27, 0, 0, tick++)),
    idgen: () => `id-${id++}`,
  };
}

describe("store", () => {
  it("validates loop configs with the model zod schema", () => {
    const store = new Store(openDatabase(":memory:"));
    const config = defaultLoopConfig();
    const row = store.saveLoop("loop-1", config);
    assert.equal(row.name, "New loop");
    assert.equal(row.version, 1);
    const again = store.saveLoop("loop-1", { ...config, name: "Renamed" });
    assert.equal(again.version, 2, "version bumps on update");
    assert.throws(() => store.saveLoop("bad", { name: "" }), StoreValidationError);
    assert.throws(() => store.saveLoop("bad", { nope: true }), StoreValidationError);
  });

  it("idempotency: a trigger key is claimed exactly once", () => {
    const store = new Store(openDatabase(":memory:"));
    assert.equal(store.claimRunKey("loop-1:event-9", "run-1"), true);
    assert.equal(store.claimRunKey("loop-1:event-9", "run-2"), false, "duplicate event never double-runs");
    assert.equal(store.claimRunKey("loop-1:event-10", "run-3"), true);
  });

  it("audit is append-only and ordered", () => {
    const store = new Store(openDatabase(":memory:"));
    store.saveLoop("loop-1", defaultLoopConfig());
    store.setLoopEnabled("loop-1", false);
    const events = store.listAudit({ loopId: "loop-1" });
    assert.deepEqual(events.map((e) => e["kind"]), ["loop.created", "loop.disabled"]);
  });

  it("refuses settings keys that look like credentials", () => {
    const store = new Store(openDatabase(":memory:"));
    assert.throws(() => store.setSetting("openrouter_api_key", "x"), StoreValidationError);
    store.setSetting("defaultHarness", "openrouter");
    assert.equal(store.getSetting("defaultHarness"), "openrouter");
  });
});

describe("runtime persistence + restore", () => {
  it("mirrors a run into runs/turns/snapshots, then boot-restores it", async () => {
    const db = openDatabase(":memory:");
    const store = new Store(db);
    store.saveLoop("loop-1", defaultLoopConfig());
    const runner = new Runner(deps());
    const brain = new ScriptBrain([[{ kind: "response", text: "hello" }]]);
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    const unsub = persistRun(runner, store, run.id);
    await runner.whenIdle(run.id);
    unsub();

    const runs = db.prepare("SELECT * FROM runs WHERE id = ?").all(run.id) as Record<string, unknown>[];
    assert.equal(runs.length, 1);
    assert.equal(runs[0]!["status"], "complete");
    const turns = db.prepare("SELECT * FROM turns WHERE run_id = ? ORDER BY position").all(run.id) as Record<string, unknown>[];
    assert.equal(turns.length, 1);
    assert.deepEqual(JSON.parse(String(turns[0]!["parts_json"])), [{ kind: "response", text: "hello" }]);
    assert.equal(store.listSnapshots().length, 1);

    // Simulated restart: fresh Runner over the SAME store restores the run.
    const runnerB = new Runner(deps());
    const { restoreRuns } = await import("./persistence.ts");
    const n = restoreRuns(runnerB, store);
    assert.equal(n, 1);
    assert.equal(runnerB.getRun(run.id).status, "complete");
    assert.equal(runnerB.getTurns(run.id).length, 1);
  });

  it("a run snapshotted mid-exchange restores as error: interrupted", async () => {
    const db = openDatabase(":memory:");
    const store = new Store(db);
    store.saveLoop("loop-1", defaultLoopConfig());
    let openGate!: () => void;
    const gate = new Promise<void>((r) => { openGate = r; });
    const runner = new Runner(deps());
    const brain = {
      async *stream(): AsyncIterable<{ kind: "thought"; text: string }> {
        yield { kind: "thought", text: "mid…" };
        await gate; // never resolves in this test: the "crash"
      },
    };
    const run = runner.start({ loopId: "loop-1", message: "go", brain });
    persistRun(runner, store, run.id);
    // let the first part land so the snapshot is genuinely mid-exchange
    await new Promise((r) => setImmediate(r));
    assert.equal(store.listSnapshots().length, 1);

    const runnerB = new Runner(deps());
    const { restoreRuns } = await import("./persistence.ts");
    restoreRuns(runnerB, store);
    const restored = runnerB.getRun(run.id);
    assert.equal(restored.status, "error");
    assert.equal(restored.error, "interrupted");
    openGate(); // release the stuck generator (test hygiene)
  });
});

describe("http", () => {
  it("serves health, static files, blocks traversal, 404s /api/*, mounts the descriptor", async () => {
    const dir = await mkdtemp(join(tmpdir(), "loops-static-"));
    await writeFile(join(dir, "index.html"), "<h1>loops</h1>");
    await writeFile(join(dir, "app.js"), "console.log(1)");
    let descriptorHits = 0;
    const app = createLoopsServer({
      dbPath: ":memory:",
      staticDir: dir,
      environmentHandler: (_req, res) => {
        descriptorHits += 1;
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ protocol: 1 }));
      },
    });
    const port = await app.listen(0, "127.0.0.1");
    const base = `http://127.0.0.1:${port}`;
    try {
      const health = (await fetch(`${base}/api/health`).then((r) => r.json())) as { ok: boolean };
      assert.equal(health.ok, true);

      const home = await fetch(`${base}/`).then(async (r) => ({ status: r.status, text: await r.text() }));
      assert.equal(home.status, 200);
      assert.match(home.text, /loops/);

      const deepLink = await fetch(`${base}/loop/abc/runs`); // SPA fallback
      assert.equal(deepLink.status, 200);

      // Raw-path traversal (fetch normalizes "/../" away client-side, so go
      // one level down: http.request sends the path verbatim).
      const traversalStatus = await new Promise<number>((resolve, reject) => {
        const req = httpRequest({ host: "127.0.0.1", port, path: "/../package.json", method: "GET" }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", reject);
        req.end();
      });
      assert.ok([400, 403, 404].includes(traversalStatus), "traversal refused");

      const api = await fetch(`${base}/api/nope`);
      assert.equal(api.status, 404);

      const env = (await fetch(`${base}/.well-known/t3/environment`).then((r) => r.json())) as { protocol: number };
      assert.equal(env.protocol, 1);
      assert.equal(descriptorHits, 1);
    } finally {
      await app.close();
      await rm(dir, { recursive: true, force: true });
    }
  });
});
