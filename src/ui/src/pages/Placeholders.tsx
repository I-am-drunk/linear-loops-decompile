/**
 * Placeholder pages for routes whose feature owners haven't landed yet.
 * Each placeholder states the owning task so a missing page is self-describing.
 * Feature pages replace entries in registry.tsx — never edit the shell.
 */
import type { JSX } from "react";

export interface PlaceholderProps {
  readonly title: string;
  /** One line on what will live here. */
  readonly description: string;
  /** Owning task id, e.g. "T-701". */
  readonly owner: string;
  /** Extra integration notes for the owner (props contract hints). */
  readonly note?: string | undefined;
}

export function PlaceholderPage(props: PlaceholderProps): JSX.Element {
  return (
    <div className="placeholder">
      <h1>{props.title}</h1>
      <p>{props.description}</p>
      <p>
        Ships with <code>{props.owner}</code>
        {props.note ? <> — {props.note}</> : null}
      </p>
    </div>
  );
}

export function NotFoundPage(props: { readonly path: string }): JSX.Element {
  return (
    <div className="placeholder">
      <h1>Page not found</h1>
      <p>
        No route matches <code>{props.path}</code>.
      </p>
    </div>
  );
}

