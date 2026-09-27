/**
 * Connect inference — the user's own AI as the loop brain. List of named
 * harnesses + an editor. Keys are write-only: the page shows "stored" and
 * accepts a replacement, it never displays one. Probe lists models; Test runs
 * a 1-token call and reports latency.
 */
import { useState } from "react";
import type { JSX } from "react";
import {
  EFFORTS,
  PROVIDERS,
  PROVIDER_DEFAULT_BASE_URL,
  PROVIDER_LABEL,
  httpPolicyMessage,
} from "./types.ts";
import type { Effort, HarnessInput, HarnessView, InferenceProvider, ProbeState } from "./types.ts";

export interface ConnectInferenceProps {
  readonly harnesses: readonly HarnessView[];
  /** Probe/test state for the harness currently being edited or tested. */
  readonly probe: ProbeState;
  readonly test: ProbeState;
  readonly onSave: (input: HarnessInput, id?: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onSetDefault: (id: string) => void;
  readonly onProbeModels: (input: HarnessInput) => void;
  readonly onTest: (id: string) => void;
}

const EMPTY: HarnessInput = {
  name: "",
  provider: "openrouter",
  baseUrl: "",
  apiKey: "",
  model: "",
  effort: "medium",
  extraHeaders: {},
  allowInsecureHttp: false,
  makeDefault: false,
};

export function ConnectInferencePage(props: ConnectInferenceProps): JSX.Element {
  const [editing, setEditing] = useState<HarnessView | null>(null);
  const [draft, setDraft] = useState<HarnessInput>(EMPTY);
  const [headerKey, setHeaderKey] = useState("");
  const [headerValue, setHeaderValue] = useState("");

  const startNew = (): void => { setEditing(null); setDraft(EMPTY); };
  const startEdit = (h: HarnessView): void => {
    setEditing(h);
    setDraft({
      name: h.name, provider: h.provider, baseUrl: h.baseUrl, apiKey: "",
      model: h.model, effort: h.effort, extraHeaders: { ...h.extraHeaders },
      allowInsecureHttp: h.allowInsecureHttp, makeDefault: h.isDefault,
    });
  };
  const set = <K extends keyof HarnessInput>(k: K, v: HarnessInput[K]): void =>
    setDraft((d) => ({ ...d, [k]: v }));

  const baseUrlHint = PROVIDER_DEFAULT_BASE_URL[draft.provider];
  const httpMsg = httpPolicyMessage(draft.baseUrl.trim() || baseUrlHint || "", draft.allowInsecureHttp);
  const canSave =
    draft.name.trim().length > 0 &&
    draft.model.trim().length > 0 &&
    (draft.baseUrl.trim() !== "" || baseUrlHint !== null) &&
    httpMsg === null;

  return (
    <div>
      <div className="st-panel">
        <h2>Harnesses</h2>
        {props.harnesses.length === 0 ? (
          <p className="st-muted" style={{ marginTop: 0 }}>
            No inference harness yet. Loops cannot run until one is connected — this is the brain.
          </p>
        ) : (
          props.harnesses.map((h) => (
            <div className="st-harness" key={h.id}>
              <span className="st-name">{h.name}</span>
              {h.isDefault ? <span className="st-badge ok">Default</span> : null}
              <span className="st-meta">{PROVIDER_LABEL[h.provider]} · {h.model}</span>
              <span className={`st-badge ${h.hasApiKey ? "ok" : ""}`}>{h.hasApiKey ? "key stored" : "no key"}</span>
              {h.allowInsecureHttp ? <span className="st-badge">http·LAN</span> : null}
              <span className="st-actions">
                <button className="btn small" onClick={() => props.onTest(h.id)}
                  disabled={props.test.kind === "running"}>
                  {props.test.kind === "running" ? "Testing…" : "Test"}
                </button>
                <button className="btn small" onClick={() => startEdit(h)}>Edit</button>
                {!h.isDefault ? (
                  <button className="btn small" onClick={() => props.onSetDefault(h.id)}>Make default</button>
                ) : null}
                <button className="btn small" onClick={() => props.onDelete(h.id)}>Delete</button>
              </span>
            </div>
          ))
        )}
        {props.test.kind === "ok" ? (
          <p className="st-ok">Test call succeeded · {`${props.test.latencyMs} ms`}{props.test.models.length > 0 ? ` · ${props.test.models.length} models visible` : ""}</p>
        ) : null}
        {props.test.kind === "error" ? <p className="st-error">{props.test.message}</p> : null}
        <div className="st-row">
          <button className="btn" onClick={startNew}>New harness</button>
        </div>
      </div>

      <div className="st-panel">
        <h2>{editing ? `Edit “${editing.name}”` : "New harness"}</h2>
        <div className="st-row">
          <span className="st-label">Name</span>
          <input className="st-input" value={draft.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. OpenRouter main" />
        </div>
        <div className="st-row">
          <span className="st-label">Provider</span>
          <select className="st-select" value={draft.provider}
            onChange={(e) => set("provider", e.target.value as InferenceProvider)}>
            {PROVIDERS.map((p) => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
          </select>
        </div>
        <div className="st-row">
          <span className="st-label">Base URL</span>
          <input className="st-input" value={draft.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder={baseUrlHint ?? "http://localhost:8000/v1 (required for this provider)"} />
        </div>
        {baseUrlHint !== null ? <p className="st-hint">Leave empty to use the default: {baseUrlHint}</p> : null}
        {httpMsg !== null ? <p className="st-error">{httpMsg}</p> : null}
        <div className="st-row">
          <label className="st-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={draft.allowInsecureHttp}
              onChange={(e) => set("allowInsecureHttp", e.target.checked)} />
            Allow plain http to a LAN server (10.x / 192.168.x / .local) — https stays required for public hosts
          </label>
        </div>
        <div className="st-row">
          <span className="st-label">API key</span>
          <input className="st-input" type="password" autoComplete="off" value={draft.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            placeholder={editing?.hasApiKey ? "Stored — enter a new key to rotate" : "sk-… (write-only)"} />
        </div>
        <p className="st-hint">Write-only: the server stores it hashed and never returns it.</p>
        <div className="st-row">
          <span className="st-label">Model</span>
          <input className="st-input" value={draft.model} onChange={(e) => set("model", e.target.value)}
            placeholder="e.g. anthropic/claude-sonnet-4" list="st-probed-models" />
          <datalist id="st-probed-models">
            {props.probe.kind === "ok" ? props.probe.models.map((m) => <option key={m} value={m} />) : null}
          </datalist>
          <button className="btn small" onClick={() => props.onProbeModels(draft)}
            disabled={props.probe.kind === "running"}>
            {props.probe.kind === "running" ? "Probing…" : "Probe models"}
          </button>
        </div>
        {props.probe.kind === "error" ? <p className="st-error">{props.probe.message}</p> : null}
        <div className="st-row">
          <span className="st-label">Effort</span>
          <select className="st-select" value={draft.effort} onChange={(e) => set("effort", e.target.value as Effort)}>
            {EFFORTS.map((e2) => <option key={e2} value={e2}>{e2}</option>)}
          </select>
        </div>
        <div className="st-row wrap">
          <span className="st-label">Extra headers</span>
          <div style={{ flex: 1 }}>
            {Object.entries(draft.extraHeaders).map(([k, v]) => (
              <div className="st-kv" key={k}>
                <input className="st-input" value={k} readOnly aria-label="header name" />
                <input className="st-input" value={v}
                  onChange={(e) => set("extraHeaders", { ...draft.extraHeaders, [k]: e.target.value })}
                  aria-label="header value" />
                <button className="btn small" onClick={() => {
                  const next = { ...draft.extraHeaders };
                  delete next[k];
                  set("extraHeaders", next);
                }}>✕</button>
              </div>
            ))}
            <div className="st-kv">
              <input className="st-input" value={headerKey} onChange={(e) => setHeaderKey(e.target.value)} placeholder="Header" />
              <input className="st-input" value={headerValue} onChange={(e) => setHeaderValue(e.target.value)} placeholder="Value" />
              <button className="btn small" onClick={() => {
                const k = headerKey.trim();
                if (!k) return;
                set("extraHeaders", { ...draft.extraHeaders, [k]: headerValue });
                setHeaderKey(""); setHeaderValue("");
              }}>Add</button>
            </div>
          </div>
        </div>
        <div className="st-row">
          <label className="st-muted" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={draft.makeDefault}
              onChange={(e) => set("makeDefault", e.target.checked)} />
            Default harness for new loops
          </label>
        </div>
        <div className="st-row">
          <button className="btn primary" disabled={!canSave}
            onClick={() => { props.onSave(draft, editing?.id); }}>
            {editing ? "Save changes" : "Create harness"}
          </button>
          {!canSave ? <span className="st-hint">Name, model, and base URL (where required) are needed.</span> : null}
        </div>
      </div>
    </div>
  );
}
