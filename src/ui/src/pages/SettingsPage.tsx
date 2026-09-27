import { useCallback, useEffect, useState } from "react";
import { call } from "../rpc.ts";

interface HarnessView {
  name: string;
  provider: string;
  baseUrl: string;
  model: string;
  isDefault: boolean;
  configured: boolean;
}

interface SettingsView {
  linear: { configured: boolean; viewerName?: string; viewerEmail?: string; organization?: string };
  inference: { harnesses: HarnessView[] };
}

export function SettingsPage() {
  const [settings, setSettings] = useState<SettingsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    call<SettingsView>("settings.get").then(setSettings).catch((e) => setError(String(e?.message ?? e)));
  }, []);
  useEffect(refresh, [refresh]);

  return (
    <div className="page">
      <h1>Settings</h1>
      <p className="lede">Connect Linear and an inference harness. Keys are write-only: they are never shown again.</p>
      {error && <p className="notice">{error}</p>}
      {settings && (
        <>
          <LinearCard settings={settings} onChanged={refresh} onError={setError} />
          <InferenceCard settings={settings} onChanged={refresh} onError={setError} />
        </>
      )}
    </div>
  );
}

function LinearCard(props: { settings: SettingsView; onChanged: () => void; onError: (e: string | null) => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const { linear } = props.settings;

  async function run(action: () => Promise<unknown>) {
    setBusy(true); props.onError(null);
    try { await action(); props.onChanged(); }
    catch (e) { props.onError(String((e as Error)?.message ?? e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <h2>Linear</h2>
      {linear.configured ? (
        <>
          <div className="row">
            <span className="badge ok">Connected</span>
            <span>{linear.viewerName} ({linear.viewerEmail})</span>
            <span className="muted">{linear.organization}</span>
          </div>
          <div className="row">
            <button className="danger" disabled={busy}
              onClick={() => run(() => call("settings.clearLinear"))}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="field">
            <label>Personal API key (api.linear.app)</label>
            <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
              placeholder="lin_api_..." autoComplete="off" />
          </div>
          <div className="row">
            <button className="primary" disabled={busy || !token}
              onClick={() => run(async () => { await call("settings.setLinear", { token }); setToken(""); })}>
              Connect
            </button>
            <span className="muted">Verified against the public API before storing.</span>
          </div>
        </>
      )}
    </section>
  );
}

function InferenceCard(props: { settings: SettingsView; onChanged: () => void; onError: (e: string | null) => void }) {
  const [form, setForm] = useState({ name: "", provider: "openrouter", baseUrl: "", model: "", apiKey: "" });
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<Record<string, string>>({});
  const harnesses = props.settings.inference.harnesses;

  async function run(action: () => Promise<unknown>) {
    setBusy(true); props.onError(null);
    try { await action(); props.onChanged(); }
    catch (e) { props.onError(String((e as Error)?.message ?? e)); }
    finally { setBusy(false); }
  }

  return (
    <section className="card">
      <h2>Inference harnesses</h2>
      {harnesses.length > 0 && (
        <table className="list">
          <thead><tr><th>Name</th><th>Provider</th><th>Model</th><th></th><th></th></tr></thead>
          <tbody>
            {harnesses.map((h) => (
              <tr key={h.name}>
                <td>{h.name} {h.isDefault && <span className="badge">default</span>}</td>
                <td>{h.provider}</td>
                <td><code>{h.model}</code></td>
                <td>
                  {probe[h.name]
                    ? <span className={`badge ${probe[h.name].startsWith("ok") ? "ok" : "err"}`}>{probe[h.name]}</span>
                    : <span className="badge ok">key stored</span>}
                </td>
                <td className="row" style={{ justifyContent: "flex-end" }}>
                  <button disabled={busy} onClick={() => run(async () => {
                    const r = await call<{ ok: boolean; latencyMs: number; error?: string }>("settings.testInference", { name: h.name });
                    setProbe((p) => ({ ...p, [h.name]: r.ok ? `ok ${r.latencyMs}ms` : (r.error ?? "failed") }));
                  })}>Test</button>
                  <button className="danger" disabled={busy}
                    onClick={() => run(() => call("settings.deleteInference", { name: h.name }))}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="field">
        <label>Name</label>
        <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="main" />
      </div>
      <div className="row">
        <div className="field">
          <label>Provider</label>
          <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
            <option value="openrouter">OpenRouter</option>
            <option value="openai-compatible">OpenAI-compatible (LiteLLM, vLLM, Ollama)</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        <div className="field">
          <label>Base URL</label>
          <input type="text" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            placeholder="https://openrouter.ai/api/v1" />
        </div>
      </div>
      <div className="row">
        <div className="field">
          <label>Model</label>
          <input type="text" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="anthropic/claude-sonnet-4.5" />
        </div>
        <div className="field">
          <label>API key (write-only)</label>
          <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} autoComplete="off" />
        </div>
      </div>
      <div className="row">
        <button className="primary" disabled={busy || !form.name || !form.baseUrl}
          onClick={() => run(async () => {
            await call("settings.setInference", { name: form.name, input: { ...form, apiKey: form.apiKey || undefined } });
            setForm({ name: "", provider: "openrouter", baseUrl: "", model: "", apiKey: "" });
          })}>
          Add harness
        </button>
        <span className="muted">The golden goose (Linear's own chat route) becomes harness-free here once the #14 probe lands.</span>
      </div>
    </section>
  );
}
