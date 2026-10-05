/**
 * The five row patterns (ST2, docs/plan/settings.md).
 *
 * "Five, and everything is one of them." Every settings row is a label, an
 * optional description, and one control on the right — so the row is one
 * layout and the control is a discriminated union, rather than five
 * near-duplicate components that drift apart.
 *
 * Pure data in, HTML string out. No DOM, no framework, no globals: that makes
 * every pattern testable without a browser, which is why the tests here can
 * assert real behavior instead of mounting something.
 */

export type RowBase = {
  /** Stable id — the mount uses it for event delegation. */
  id: string;
  label: string;
  description?: string;
  /** A disabled row renders its control inert and dimmed. */
  disabled?: boolean;
};

export type SelectOption = { value: string; label: string };

/** Connection state for the `connection` row's status badge. */
export type ConnectionState = `connected` | `disconnected` | `error` | `checking`;

export type Row =
  | (RowBase & { kind: `toggle`; on: boolean })
  | (RowBase & { kind: `select`; value: string; options: SelectOption[] })
  | (RowBase & { kind: `text`; value: string; placeholder?: string })
  /**
   * Write-only by construction: there is no field that could carry a secret
   * outward. `configured` is presence; `hint` is a masked tail for
   * recognition. docs/plan/inference.md requires this and the model layer
   * already behaves this way server-side.
   */
  | (RowBase & { kind: `credential`; configured: boolean; hint?: string })
  | (RowBase & { kind: `connection`; state: ConnectionState; detail?: string });

export type Section = {
  id: string;
  title: string;
  /** Optional one-line explanation under the section title. */
  blurb?: string;
  rows: Row[];
};

export type Page = {
  id: string;
  title: string;
  sections: Section[];
};
