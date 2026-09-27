/** Settings home: the two connects the user asked for + environment status. */
import type { JSX } from "react";
import { href } from "../../useHashRoute.ts";
import type { EnvironmentDescriptorView, HarnessView, LinearConnectionView } from "./types.ts";

export interface SettingsHomeProps {
  readonly linear: LinearConnectionView;
  readonly harnesses: readonly HarnessView[];
  readonly environment: EnvironmentDescriptorView | null;
}

export function SettingsHomePage(props: SettingsHomeProps): JSX.Element {
  const linearState =
    props.linear.status === "connected"
      ? <span className="st-badge ok">Connected{props.linear.organization ? ` · ${props.linear.organization.name}` : ""}</span>
      : <span className="st-badge">Not connected</span>;
  const defaultHarness = props.harnesses.find((h) => h.isDefault);
  const inferenceState = defaultHarness
    ? <span className="st-badge ok">{defaultHarness.name} · {defaultHarness.model}</span>
    : <span className="st-badge warn">No default harness</span>;
  const envState = props.environment
    ? <span className="st-badge ok">{props.environment.label}</span>
    : <span className="st-badge">Offline</span>;
  return (
    <div className="st-grid">
      <a className="st-card" href={href({ name: "settings-linear" })}>
        <h2>Connect Linear</h2>
        <p>Log in with your Linear account. Loops read and write your real workspace.</p>
        <div className="st-state">{linearState}</div>
      </a>
      <a className="st-card" href={href({ name: "settings-inference" })}>
        <h2>Connect inference</h2>
        <p>Your own AI harness: OpenRouter, LiteLLM, vLLM, Ollama, Anthropic.</p>
        <div className="st-state">{inferenceState}</div>
      </a>
      <a className="st-card" href={href({ name: "settings-environment" })}>
        <h2>Environment</h2>
        <p>This loops server: pairing, sessions, transport status.</p>
        <div className="st-state">{envState}</div>
      </a>
    </div>
  );
}

