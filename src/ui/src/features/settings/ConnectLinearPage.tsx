/**
 * Connect Linear — framed as "log into your Linear account" (product vision).
 * v1: paste a personal API key; the server verifies it with a `viewer` query
 * and stores it write-only (never echoed). OAuth device flow is a placeholder.
 */
import { useState } from "react";
import type { JSX } from "react";
import type { LinearConnectionView } from "./types.ts";

export interface ConnectLinearProps {
  readonly connection: LinearConnectionView;
  /** Called with the pasted PAT. The page never retains it after submit. */
  readonly onVerify: (personalAccessToken: string) => void;
  readonly onDisconnect: () => void;
}

export function ConnectLinearPage(props: ConnectLinearProps): JSX.Element {
  const [pat, setPat] = useState("");
  const c = props.connection;
  const busy = c.status === "verifying";

  return (
    <div>
      <div className="st-panel">
        <h2>Linear account</h2>
        {c.status === "connected" ? (
          <>
            <dl className="st-dl">
              <dt>Signed in as</dt>
              <dd>{c.user ? `${c.user.name} (${c.user.email})` : "—"}</dd>
              <dt>Workspace</dt>
              <dd>{c.organization ? `${c.organization.name} (${c.organization.urlKey})` : "—"}</dd>
            </dl>
            {c.rateBudget ? (
              <>
                <div className="st-muted" style={{ marginTop: 10 }}>
                  API budget: {c.rateBudget.used.toLocaleString()} / {c.rateBudget.limit.toLocaleString()} requests this hour
                </div>
                <div className="st-meter" aria-hidden="true">
                  <div style={{ width: `${Math.min(100, (100 * c.rateBudget.used) / Math.max(1, c.rateBudget.limit))}%` }} />
                </div>
              </>
            ) : null}
            <div className="st-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={props.onDisconnect}>Disconnect</button>
              <span className="st-hint">The stored key is write-only and never displayed.</span>
            </div>
          </>
        ) : (
          <>
            <p className="st-muted" style={{ marginTop: 0 }}>
              Paste a personal API key from Linear → Settings → API. The server verifies it and
              stores it write-only — it is never shown again.
            </p>
            <div className="st-row">
              <span className="st-label">Personal API key</span>
              <input
                className="st-input"
                type="password"
                autoComplete="off"
                placeholder="lin_api_…"
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                aria-label="Linear personal API key"
              />
            </div>
            {c.status === "error" && c.error ? <p className="st-error">{c.error}</p> : null}
            <div className="st-row">
              <button
                className="btn primary"
                disabled={busy || pat.trim().length === 0}
                onClick={() => { props.onVerify(pat.trim()); setPat(""); }}
              >
                {busy ? "Verifying…" : "Connect"}
              </button>
              <button className="btn" disabled title="OAuth device flow — planned, not built (v1 placeholder)">
                Log in with Linear (soon)
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

