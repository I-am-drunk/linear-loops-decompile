/**
 * T-601 verification: schema validation, write-only secret storage, and the
 * settings store's CRUD/default/key-rotation guarantees. Run: npm test
 * (Node >= 22; uses node:test + node:sqlite in-memory databases).
 */

import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  CreateHarnessInputSchema,
  HarnessSettingsStore,
  SecretNotFoundError,
  SecretUndecryptableError,
  SettingsValidationError,
  SqliteSecretStore,
} from "../src/index.ts";

// --- helpers ---------------------------------------------------------------

function makeSecrets() {
  return new SqliteSecretStore(new DatabaseSync(":memory:"), randomBytes(32));
}

function makeStore() {
  const secrets = makeSecrets();
  const store = new HarnessSettingsStore(new DatabaseSync(":memory:"), secrets);
  return { store, secrets };
}

const OPENAI_COMPAT = {
  name: "local-vllm",
  provider: "openai-compatible" as const,
  baseUrl: "http://localhost:8000/v1",
  apiKey: "sk-test-123",
  model: "meta-llama/llama-3.1-70b",
};

// --- schema validation ------------------------------------------------------

test("baseUrl: https accepted, trailing slash stripped", () => {
  const r = CreateHarnessInputSchema.safeParse({
    name: "or",
    provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1/",
    model: "anthropic/claude-sonnet-4",
  });
  assert.ok(r.success);
  assert.equal(r.data.baseUrl, "https://openrouter.ai/api/v1");
  assert.equal(r.data.effort, "medium"); // default applied
  assert.deepEqual(r.data.extraHeaders, {});
});

test("baseUrl: plain http rejected off-loopback, allowed on loopback", () => {
  assert.ok(
    !CreateHarnessInputSchema.safeParse({
      name: "bad",
      provider: "openai-compatible",
      baseUrl: "http://192.168.1.10:8000",
      model: "x",
    }).success,
  );
  for (const u of ["http://localhost:11434", "http://127.0.0.1:8000/v1"]) {
    assert.ok(
      CreateHarnessInputSchema.safeParse({
        name: "ok",
        provider: "openai-compatible",
        baseUrl: u,
        model: "x",
      }).success,
      u,
    );
  }
});

test("baseUrl: provider defaults; openai-compatible has none and requires one", () => {
  const r = CreateHarnessInputSchema.safeParse({
    name: "or",
    provider: "openrouter",
    model: "m",
  });
  assert.ok(r.success);
  assert.equal(r.data.baseUrl, undefined); // store applies DEFAULT_BASE_URLS
  assert.ok(
    !CreateHarnessInputSchema.safeParse({
      name: "x",
      provider: "openai-compatible",
      model: "m",
    }).success,
  );
});

test("extraHeaders: illegal header names rejected", () => {
  assert.ok(
    !CreateHarnessInputSchema.safeParse({
      name: "h",
      provider: "openrouter",
      model: "m",
      extraHeaders: { "bad header": "v" },
    }).success,
  );
  assert.ok(
    CreateHarnessInputSchema.safeParse({
      name: "h",
      provider: "openrouter",
      model: "m",
      extraHeaders: { "HTTP-Referer": "https://example.com", "X-Title": "loops" },
    }).success,
  );
});

// --- secret store -----------------------------------------------------------

test("secrets: put/get/has/delete roundtrip", () => {
  const s = makeSecrets();
  const ref = s.put("sk-live-secret");
  assert.match(ref, /^sec_/);
  assert.ok(s.has(ref));
  assert.equal(s.get(ref), "sk-live-secret");
  assert.ok(s.delete(ref));
  assert.ok(!s.has(ref));
  assert.throws(() => s.get(ref), SecretNotFoundError);
});

test("secrets: wrong master key surfaces as undecryptable, not garbage", () => {
  const db = new DatabaseSync(":memory:");
  const a = new SqliteSecretStore(db, randomBytes(32));
  const ref = a.put("sk-live-secret");
  const b = new SqliteSecretStore(db, randomBytes(32)); // same db, wrong key
  assert.throws(() => b.get(ref), SecretUndecryptableError);
});

// --- settings store ---------------------------------------------------------

test("create: public DTO hides all key material; first harness auto-default", () => {
  const { store } = makeStore();
  const h = store.create(OPENAI_COMPAT);
  assert.equal(h.hasApiKey, true);
  assert.equal(h.isDefault, true);
  assert.equal(h.baseUrl, "http://localhost:8000/v1");
  assert.ok(!("apiKeyRef" in h), "DTO must not carry apiKeyRef");
  assert.ok(!("apiKey" in h), "DTO must not carry apiKey");
  assert.equal(JSON.stringify(h).includes("sk-test-123"), false, "DTO must not leak the key");
});

test("default management: setDefault moves the flag", () => {
  const { store } = makeStore();
  const a = store.create(OPENAI_COMPAT);
  const b = store.create({ ...OPENAI_COMPAT, name: "anthropic", provider: "anthropic", model: "claude-sonnet-4-6" });
  assert.equal(a.isDefault, true);
  assert.equal(b.isDefault, false);
  store.setDefault(b.id);
  assert.equal(store.get(a.id)?.isDefault, false);
  assert.equal(store.getDefault()?.id, b.id);
});

test("update: key rotation replaces the secret and destroys the old one", () => {
  const { store, secrets } = makeStore();
  const h = store.create(OPENAI_COMPAT);
  const oldRef = store.resolveForAdapter(h.id).settings.apiKeyRef;
  assert.ok(oldRef);
  const updated = store.update(h.id, { apiKey: "sk-rotated" });
  assert.equal(updated.hasApiKey, true);
  assert.ok(!secrets.has(oldRef), "old secret must be destroyed on rotation");
  assert.equal(store.resolveForAdapter(h.id).apiKey, "sk-rotated");
});

test("update: clearApiKey drops the key; patch without key fields leaves it", () => {
  const { store, secrets } = makeStore();
  const h = store.create(OPENAI_COMPAT);
  const ref = store.resolveForAdapter(h.id).settings.apiKeyRef;
  store.update(h.id, { model: "new-model" });
  assert.ok(secrets.has(ref!), "untouched key survives a model patch");
  const cleared = store.update(h.id, { clearApiKey: true });
  assert.equal(cleared.hasApiKey, false);
  assert.ok(!secrets.has(ref!));
  assert.equal(store.resolveForAdapter(h.id).apiKey, null);
});

test("remove: deletes harness and its secret", () => {
  const { store, secrets } = makeStore();
  const h = store.create(OPENAI_COMPAT);
  const ref = store.resolveForAdapter(h.id).settings.apiKeyRef;
  assert.ok(store.remove(h.id));
  assert.equal(store.get(h.id), null);
  assert.ok(!secrets.has(ref!));
});

test("validation: bad input raises SettingsValidationError with readable issues", () => {
  const { store } = makeStore();
  assert.throws(
    () => store.create({ name: "", provider: "openrouter", model: "m" }),
    (err: unknown) =>
      err instanceof SettingsValidationError &&
      Array.isArray(err.issues) &&
      err.issues.length > 0,
  );
});

test("lookup: getByName is case-insensitive; resolveForAdapter accepts name", () => {
  const { store } = makeStore();
  store.create(OPENAI_COMPAT);
  assert.equal(store.getByName("LOCAL-VLLM")?.name, "local-vllm");
  assert.equal(store.resolveForAdapter("Local-Vllm").apiKey, "sk-test-123");
});

test("list: returns all harnesses in creation order", () => {
  const { store } = makeStore();
  store.create(OPENAI_COMPAT);
  store.create({ ...OPENAI_COMPAT, name: "second" });
  assert.deepEqual(
    store.list().map((h) => h.name),
    ["local-vllm", "second"],
  );
});


// --- T-603 additions: header denylist + LAN http opt-in + orphan sweep ------

test("extraHeaders: adapter-managed headers are rejected (agent-09 review)", () => {
  for (const bad of ["authorization", "X-API-Key", "Host", "Content-Length"]) {
    const r = CreateHarnessInputSchema.safeParse({
      name: "hdr",
      provider: "openrouter",
      model: "m",
      extraHeaders: { [bad]: "x" },
    });
    assert.ok(!r.success, `expected ${bad} to be rejected`);
  }
  // ordinary headers still pass
  assert.ok(
    CreateHarnessInputSchema.safeParse({
      name: "hdr",
      provider: "openrouter",
      model: "m",
      extraHeaders: { "X-Title": "loops" },
    }).success,
  );
});

test("baseUrl: LAN http needs allowInsecureHttp; public http always rejected", () => {
  const lan = {
    name: "ollama-lan",
    provider: "openai-compatible" as const,
    baseUrl: "http://192.168.1.50:11434/v1",
    model: "llama3.1",
  };
  // blocked by default…
  assert.ok(!CreateHarnessInputSchema.safeParse(lan).success);
  // …allowed with the explicit opt-in (agent-09's home-lab scenario)
  const ok = CreateHarnessInputSchema.safeParse({ ...lan, allowInsecureHttp: true });
  assert.ok(ok.success);
  assert.equal(ok.data.allowInsecureHttp, true);
  // .local mDNS host works the same way
  assert.ok(
    CreateHarnessInputSchema.safeParse({
      ...lan,
      baseUrl: "http://gpu-box.local:8000/v1",
      allowInsecureHttp: true,
    }).success,
  );
  // public http stays blocked even with the flag
  assert.ok(
    !CreateHarnessInputSchema.safeParse({
      ...lan,
      baseUrl: "http://example.com/v1",
      allowInsecureHttp: true,
    }).success,
  );
});

test("update: relaxing baseUrl to LAN http requires the flag on the merged record", () => {
  const { store } = makeStore();
  const h = store.create({ ...OPENAI_COMPAT, baseUrl: "http://localhost:8000/v1" });
  assert.throws(
    () => store.update(h.id, { baseUrl: "http://192.168.1.50:11434/v1" }),
    SettingsValidationError,
  );
  const moved = store.update(h.id, {
    baseUrl: "http://192.168.1.50:11434/v1",
    allowInsecureHttp: true,
  });
  assert.equal(moved.allowInsecureHttp, true);
  assert.equal(moved.baseUrl, "http://192.168.1.50:11434/v1");
});

test("secrets: orphan sweep on store boot removes unreferenced secrets", () => {
  const db = new DatabaseSync(":memory:");
  const secrets = new SqliteSecretStore(db, randomBytes(32));
  const storeDb = new DatabaseSync(":memory:");
  const store = new HarnessSettingsStore(storeDb, secrets);
  const h = store.create(OPENAI_COMPAT); // one live secret
  const orphan = secrets.put("sk-stranded"); // never referenced
  assert.ok(secrets.has(orphan));

  // Re-opening the store against the same rows sweeps only the orphan.
  const reopened = new HarnessSettingsStore(storeDb, secrets);
  assert.ok(!secrets.has(orphan));
  assert.ok(reopened.get(h.id)?.hasApiKey); // live key untouched
  assert.equal(reopened.sweepOrphanSecrets(), 0); // idempotent
});
