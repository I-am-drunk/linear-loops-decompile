/**
 * Settings pages smoke tests (T-802): renderToString over the four settings
 * surfaces with fixtures; asserts the product-critical elements render:
 * connect framing, write-only key copy, provider list, budget meter, pairing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "react-dom/server";
import {
  ConnectInferencePage,
  ConnectLinearPage,
  EnvironmentPage,
  SettingsHomePage,
} from "../src/features/settings/index.ts";
import { httpPolicyMessage } from "../src/features/settings/types.ts";
import type { HarnessView } from "../src/features/settings/types.ts";
import {
  demoEnvironment,
  demoHarnesses,
  demoLinearConnected,
  demoLinearDisconnected,
  demoSessions,
} from "../src/features/settings/fixtures.ts";

const noop = () => {};

test("settings home links the three surfaces and shows live state", () => {
  const html = renderToString(
    <SettingsHomePage linear={demoLinearConnected} harnesses={demoHarnesses} environment={demoEnvironment} />,
  );
  for (const needle of ["Connect Linear", "Connect inference", "Environment", "#/settings/linear", "#/settings/inference", "#/settings/environment", "Acme", "OpenRouter main"]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("connect Linear (disconnected): PAT field, write-only copy, OAuth placeholder", () => {
  const html = renderToString(
    <ConnectLinearPage connection={demoLinearDisconnected} onVerify={noop} onDisconnect={noop} />,
  );
  for (const needle of ["Personal API key", "write-only", "Connect", "Log in with Linear (soon)"]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("connect Linear (connected): identity, workspace, budget meter, disconnect", () => {
  const html = renderToString(
    <ConnectLinearPage connection={demoLinearConnected} onVerify={noop} onDisconnect={noop} />,
  );
  for (const needle of ["Jae (jae@example.com)", "Acme (acme)", "212", "2,500", "Disconnect"]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("connect inference: harness rows, default badge, key-stored badge, editor fields", () => {
  const html = renderToString(
    <ConnectInferencePage
      harnesses={demoHarnesses}
      probe={{ kind: "idle" }}
      test={{ kind: "idle" }}
      onSave={noop} onDelete={noop} onSetDefault={noop} onProbeModels={noop} onTest={noop}
    />,
  );
  for (const needle of [
    "OpenRouter main", "Default", "key stored", "Local vLLM", "no key",
    "New harness", "Provider", "Base URL", "API key", "Probe models", "Effort", "Extra headers",
    "LiteLLM / vLLM / Ollama", "Create harness",
  ]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("connect inference: probe failure surfaces, test success reports latency", () => {
  const html = renderToString(
    <ConnectInferencePage
      harnesses={demoHarnesses}
      probe={{ kind: "error", message: "401 unauthorized" }}
      test={{ kind: "ok", models: ["a", "b"], latencyMs: 183 }}
      onSave={noop} onDelete={noop} onSetDefault={noop} onProbeModels={noop} onTest={noop}
    />,
  );
  assert.ok(html.includes("401 unauthorized"));
  assert.ok(html.includes("183 ms"));
});

test("environment page: descriptor fields + paired sessions + revoke", () => {
  const html = renderToString(
    <EnvironmentPage environment={demoEnvironment} sessions={demoSessions} onPair={noop} onRevoke={noop} />,
  );
  for (const needle of ["home-server", "env_9f2c7a", "protocol v1", "loops, runs, settings", "Pair device", "laptop browser", "This session", "Revoke"]) {
    assert.ok(html.includes(needle), `missing ${needle}`);
  }
});

test("environment page: unreachable server is surfaced, never hidden", () => {
  const html = renderToString(
    <EnvironmentPage environment={null} sessions={[]} onPair={noop} onRevoke={noop} />,
  );
  assert.ok(html.includes("Server descriptor unreachable"));
});


test("http policy mirror: loopback ok, LAN gated by the flag, public http blocked", () => {
  // https anywhere is fine
  assert.equal(httpPolicyMessage("https://openrouter.ai/api/v1", false), null);
  // loopback http is fine without the flag
  assert.equal(httpPolicyMessage("http://localhost:11434", false), null);
  assert.equal(httpPolicyMessage("http://127.0.0.1:8000/v1", false), null);
  // LAN http needs the opt-in
  assert.ok(httpPolicyMessage("http://192.168.1.20:8000/v1", false) !== null);
  assert.equal(httpPolicyMessage("http://192.168.1.20:8000/v1", true), null);
  assert.equal(httpPolicyMessage("http://10.0.0.5:4000", true), null);
  assert.equal(httpPolicyMessage("http://nas.local:8080", true), null);
  // public http stays blocked even with the flag
  assert.ok(httpPolicyMessage("http://example.com/v1", true) !== null);
  // unparseable input defers to the format check, not this rule
  assert.equal(httpPolicyMessage("not a url", false), null);
});

test("connect inference: a LAN harness shows the http·LAN badge", () => {
  const lan: HarnessView = { ...demoHarnesses[1]!, allowInsecureHttp: true };
  const html = renderToString(
    <ConnectInferencePage
      harnesses={[lan]}
      probe={{ kind: "idle" }}
      test={{ kind: "idle" }}
      onSave={noop} onDelete={noop} onSetDefault={noop} onProbeModels={noop} onTest={noop}
    />,
  );
  assert.ok(html.includes("http·LAN"), "missing the http·LAN badge");
  // and the badge is absent for a https harness
  const html2 = renderToString(
    <ConnectInferencePage
      harnesses={[demoHarnesses[0]!]}
      probe={{ kind: "idle" }}
      test={{ kind: "idle" }}
      onSave={noop} onDelete={noop} onSetDefault={noop} onProbeModels={noop} onTest={noop}
    />,
  );
  assert.ok(!html2.includes("http·LAN"), "badge must not render for https harnesses");
});
