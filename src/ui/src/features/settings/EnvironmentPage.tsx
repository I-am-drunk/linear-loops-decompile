/**
 * Environment — the T3 connect status page (R9's descriptor, pairing, and
 * active sessions). This machine is the "environment"; remote UIs pair to it.
 */
import type { JSX } from "react";
import type { EnvironmentDescriptorView, SessionTokenView } from "./types.ts";

export interface EnvironmentPageProps {
  /** null when the server is unreachable (we're the UI it serves, so this
   *  means something is very wrong — surface it, don't hide it). */
  readonly environment: EnvironmentDescriptorView | null;
  readonly sessions: readonly SessionTokenView[];
  readonly onPair: () => void;
  readonly onRevoke: (tokenId: string) => void;
}

export function EnvironmentPage(props: EnvironmentPageProps): JSX.Element {
  const env = props.environment;
  return (
    <div>
      <div className="st-panel">
        <h2>This environment</h2>
        {env === null ? (
          <p className="st-error" style={{ marginTop: 0 }}>
            Server descriptor unreachable — the loops server is not responding.
          </p>
        ) : (
          <dl className="st-dl">
            <dt>Label</dt><dd>{env.label}</dd>
            <dt>Environment id</dt><dd>{env.id}</dd>
            <dt>Product</dt><dd>{`${env.product} · protocol v${env.protocol} · ${env.version}`}</dd>
            <dt>Platform</dt><dd>{env.platform}</dd>
            <dt>Capabilities</dt><dd>{env.capabilities.join(", ")}</dd>
            {env.publicUrl ? (<><dt>Public URL</dt><dd>{env.publicUrl}</dd></>) : null}
          </dl>
        )}
        <div className="st-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={props.onPair} disabled={env === null}>Pair device</button>
          <span className="st-hint">Creates a one-time connection string; the remote side exchanges it for a scoped token.</span>
        </div>
      </div>
      <div className="st-panel">
        <h2>Paired sessions</h2>
        {props.sessions.length === 0 ? (
          <p className="st-muted" style={{ marginTop: 0 }}>No paired sessions. This UI is talking to the server directly.</p>
        ) : (
          props.sessions.map((s) => (
            <div className="st-harness" key={s.id}>
              <span className="st-name">{s.label}</span>
              {s.current ? <span className="st-badge ok">This session</span> : null}
              <span className="st-meta">{s.scopes.join(" ")}</span>
              <span className="st-meta">created {s.createdAt}{s.lastUsedAt ? ` · last used ${s.lastUsedAt}` : ""}</span>
              <span className="st-actions">
                <button className="btn small" disabled={s.current === true} onClick={() => props.onRevoke(s.id)}>Revoke</button>
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

