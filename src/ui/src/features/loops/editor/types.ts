/**
 * T-702 — loop editor view contracts.
 *
 * The editor is a controlled, props-only form over a `LoopConfig` DRAFT
 * (src/model): every edit calls `onChange` with the next config; nothing is
 * mutated in place; the page never fetches. Publishing, persistence, and the
 * server-side zod gate all live above this component (R9 container → server).
 */
import type { LoopConfig } from "../../../../../model/index.ts";

export interface NamedId {
  readonly id: string;
  readonly name: string;
}

/** A trusted source the workspace allows; loops may narrow, never widen. */
export interface TrustedSourceOption {
  readonly key: string;
  readonly label: string;
}

/** One validation complaint, flattened for display (mirrors parseLoopConfig). */
export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface LoopEditorProps {
  /** The draft config being edited. Treated as immutable. */
  readonly draft: LoopConfig;
  /** Every edit emits the NEXT config. */
  readonly onChange: (next: LoopConfig) => void;
  /** Publish the draft as the live config (disabled while invalid). */
  readonly onPublish: () => void;
  /** Danger zone: delete the loop entirely. */
  readonly onDelete: () => void;
  /** Pick-lists, pre-joined by the container. */
  readonly teams: readonly NamedId[];
  readonly projects: readonly NamedId[];
  readonly trustedSources: readonly TrustedSourceOption[];
  /** Issues the server returned on the last failed publish, if any. */
  readonly serverIssues?: readonly ValidationIssue[] | undefined;
  /** Unsaved changes exist (draft differs from the live config). */
  readonly dirty?: boolean | undefined;
  /** A publish is in flight. */
  readonly publishing?: boolean | undefined;
  /** Set when editing an existing loop; absent in the new-loop flow. */
  readonly publishedVersion?: number | undefined;
}
