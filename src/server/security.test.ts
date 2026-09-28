import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "./store.ts";
import { probeInference } from "./inference.ts";

test("credential database and WAL files are private even under umask 000", () => {
  const dir = mkdtempSync(join(tmpdir(), "private-store-"));
  const previous = process.umask(0);
  let store: Store | undefined;
  try {
    const db = join(dir, "data", "loops.db");
    store = new Store(db);
    store.setSetting("secret", "synthetic");
    assert.equal(statSync(join(dir, "data")).mode & 0o777, 0o700);
    for (const path of [db, db + "-wal", db + "-shm"]) {
      assert.equal(statSync(path).mode & 0o777, 0o600);
    }
  } finally {
    store?.close(); process.umask(previous); rmSync(dir, { recursive: true, force: true });
  }
});

test("unsafe existing directories, database files, symlinks and sidecars fail closed", () => {
  const dir = mkdtempSync(join(tmpdir(), "unsafe-store-"));
  const db = join(dir, "loops.db");
  try {
    chmodSync(dir, 0o755);
    assert.throws(() => new Store(db), /private/);
    chmodSync(dir, 0o700);
    writeFileSync(db, "", { mode: 0o644 });
    chmodSync(db, 0o644);
    assert.throws(() => new Store(db), /private/);
    rmSync(db);
    writeFileSync(join(dir, "target"), "", { mode: 0o600 });
    symlinkSync(join(dir, "target"), db);
    assert.throws(() => new Store(db), /private/);
    rmSync(db);
    writeFileSync(db + "-wal", "", { mode: 0o644 });
    chmodSync(db + "-wal", 0o644);
    assert.throws(() => new Store(db), /private/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("inference probes disallow redirects that could forward provider credentials", async () => {
  let calls = 0;
  const probe = await probeInference({ name: "h", provider: "anthropic", baseUrl: "https://original.example", model: "m", isDefault: true, createdAt: "", apiKey: "synthetic" }, (async (_url, init) => {
    calls++;
    assert.equal(init?.redirect, "error");
    throw new TypeError("redirect refused");
  }) as typeof fetch);
  assert.equal(calls, 1);
  assert.equal(probe.ok, false);
});
