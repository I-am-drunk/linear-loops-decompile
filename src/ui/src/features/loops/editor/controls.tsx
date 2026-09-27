/**
 * T-702 — tiny shared form controls for the editor blocks. Presentational,
 * controlled, no state. Keeps every block on the same a11y pattern
 * (label + control + hint/error line).
 */
import type { JSX, ReactNode } from "react";

export function Field(props: {
  readonly label: string;
  readonly hint?: string | undefined;
  readonly error?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div className="le-field">
      <span className="le-label">{props.label}</span>
      {props.children}
      {props.error ? (
        <span className="le-error">{props.error}</span>
      ) : props.hint ? (
        <span className="le-hint">{props.hint}</span>
      ) : null}
    </div>
  );
}

export function Block(props: {
  readonly title: string;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section className="le-block">
      <h2 className="le-block-title">{props.title}</h2>
      {props.children}
    </section>
  );
}
