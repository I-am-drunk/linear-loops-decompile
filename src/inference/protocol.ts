/**
 * DESIGN: server-only protocol adapter port, not an enabled Provider.
 * Evidence/mapping: docs/linear-chat-adapter-contract.md.
 * No credential values, wire RPC names or executable transport live here.
 */
import type { CredentialStatus, Model, ProviderId } from "./types.ts";

export type JsonValue =
  | null | boolean | number | string
  | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/** Unknown is not unsupported, and source inspection is not a live check. */
export type Capability =
  | { state: "verified"; evidence: string }
  | { state: "unsupported"; reason: string }
  | { state: "unverified"; reason: string };

export interface ProtocolConnection {
  provider: ProviderId;
  connectionId: string;
  credential: CredentialStatus;
  state: "unconfigured" | "connected" | "reauthenticationRequired"
    | "incompatible" | "unavailable";
  /** Pinned adapter contract and observed peer version, if actually exposed. */
  contractRevision: string;
  peerVersion?: string;
  capabilities: Readonly<Record<
    "send" | "snapshot" | "stream" | "cancel" | "replay" | "respond", Capability
  >>;
}

export type ModelSelection =
  | { kind: "provider-default" }
  | { kind: "model"; modelId: string; providerInstanceId?: string };

export interface ProtocolModelCatalog {
  models: readonly (Model & { providerInstanceId?: string })[];
  providerDefault: Capability;
}

export interface OperationContext {
  /** Absolute epoch milliseconds; abort/deadline only stops local waiting. */
  deadlineMs: number;
  signal?: AbortSignal;
}

export interface ProtocolTurnRequest {
  runId: string;
  attemptId: string;
  /** Current user input; not an instruction to replay earlier user messages. */
  text: string;
  selection: ModelSelection;
}

export interface RemoteIdentifier {
  kind: "conversation" | "thread" | "command" | "userMessage"
    | "assistantTurn" | "iteration";
  value: string;
}

/** Persist before dispatch and after every identifier update. No secrets. */
export interface ProtocolTurnRef {
  provider: ProviderId;
  connectionId: string;
  runId: string;
  attemptId: string;
  identifiers: readonly RemoteIdentifier[];
}

export interface ProtocolFailure {
  kind: "authentication" | "permission" | "billing" | "usageLimit"
    | "untrustedSources" | "rateLimited" | "incompatible" | "unavailable"
    | "unknown";
  /** Sanitized, not raw upstream response text. */
  detail: string;
  retryAfterMs?: number;
  usageLimitScope?: "loop" | "workspace";
  usageLimitResetsAt?: string;
  retryResolution?: string;
}

export type ProtocolRead<T> =
  | { ok: true; value: T }
  | { ok: false; error: ProtocolFailure };

/** Acknowledged is NOT completed. Indeterminate MUST NOT trigger fallback. */
export type ProtocolWrite =
  | { state: "not-dispatched"; error: ProtocolFailure }
  | { state: "rejected"; ref: ProtocolTurnRef; error: ProtocolFailure }
  | { state: "acknowledged"; ref: ProtocolTurnRef }
  | { state: "indeterminate"; ref: ProtocolTurnRef; error: ProtocolFailure };

export type Content =
  | { format: "text"; text: string }
  | { format: "prosemirror"; document: JsonValue };

export interface PartIdentity {
  id: string;
  /** Omit only when absent; an uncorrelated part cannot complete our turn. */
  turnId?: string;
  phase?: "answer" | "commentary";
}

export type ProtocolPart = PartIdentity & (
  | { kind: "prompt" | "event" | "text" | "reasoning"; content: Content }
  | { kind: "tool"; name: string; status: string; display?: Content;
      args?: JsonValue; result?: JsonValue }
  | { kind: "widget"; name: string; display?: Content }
  | { kind: "placeholder"; name?: string }
  | { kind: "elicitation"; request: PendingDecision }
  | { kind: "elicitationResponse"; requestId: string; actorId?: string }
  | { kind: "error"; error: ProtocolFailure }
  | { kind: "ack"; value: "done" | "ignored" | "skipped" | "waiting" }
  | { kind: "unsupported"; remoteType: string }
);

export type DecisionValue =
  | { kind: "confirmation"; confirmed: boolean }
  | { kind: "choice"; optionId: string }
  | { kind: "entities"; entityIds: readonly string[] }
  | { kind: "connection"; integrationId: string }
  | { kind: "answers"; answers: Readonly<Record<string, readonly string[]>> };

export interface PendingDecision {
  requestId: string;
  turnId: string;
  title?: string;
  /** Only actions actually supported by this connection; no guessed decline. */
  actions: readonly { id: string; label: string; kind: DecisionValue["kind"] }[];
}

export interface DecisionSubmission {
  ref: ProtocolTurnRef;
  turnId: string;
  requestId: string;
  actionId: string;
  actorId: string;
  /** Stable local audit ID, not a claim of upstream deduplication. */
  decisionId: string;
  value: DecisionValue;
}

export type TurnState =
  | { kind: "pending" | "running" | "indeterminate" }
  | { kind: "suspended"; reason: "awaitingInput" | "waiting";
      decisions: readonly PendingDecision[] }
  | { kind: "completed" | "interrupted" | "canceled"; turnId: string }
  | { kind: "failed"; turnId: string; error: ProtocolFailure };

export type Measurement<T> =
  | { known: false }
  | { known: true; value: T };

/** Adapter-issued checkpoint, bound to the connection and turn. Never sort. */
export interface ResumeCheckpoint {
  ref: ProtocolTurnRef;
  token: string;
}

export interface TurnSnapshot {
  ref: ProtocolTurnRef;
  state: TurnState;
  /** Full normalized snapshot; null means not hydrated, not empty success. */
  parts: readonly ProtocolPart[] | null;
  usage: Measurement<{ inputTokens: number; outputTokens: number }>;
  cost: Measurement<{ cents: number }>;
  checkpoint?: ResumeCheckpoint;
}

/** Replacement snapshots avoid exposing unapplied ProseMirror steps. */
export type ProtocolEvent =
  | { kind: "snapshot"; eventId: string; snapshot: TurnSnapshot }
  | { kind: "resyncRequired"; ref: ProtocolTurnRef; reason: string };

/**
 * Future Linear chat and T3 Code Connect adapters implement this port.
 * Methods return typed failures; unsupported operations never guess a wire API.
 * Expected disconnects are values, not successful iterator exhaustion.
 */
export interface ProtocolAdapter {
  readonly id: ProviderId;
  inspect(context: OperationContext): Promise<ProtocolRead<ProtocolConnection>>;
  models(context: OperationContext): Promise<ProtocolRead<ProtocolModelCatalog>>;
  /** Pure estimate; unknown prices produce known:false, never an invented zero. */
  estimate(request: ProtocolTurnRequest): Measurement<{ cents: number }>;
  /** Pure local preparation. Caller durably records request+ref before send. */
  prepare(request: ProtocolTurnRequest): ProtocolRead<ProtocolTurnRef>;
  send(request: ProtocolTurnRequest, ref: ProtocolTurnRef,
    context: OperationContext): Promise<ProtocolWrite>;
  /** Read-only reconciliation, including after an uncertain write. */
  snapshot(ref: ProtocolTurnRef,
    context: OperationContext): Promise<ProtocolRead<TurnSnapshot>>;
  /** Replay never reissues send; event IDs are stable across replay. */
  observe(ref: ProtocolTurnRef, checkpoint: ResumeCheckpoint | undefined,
    context: OperationContext): AsyncIterable<ProtocolRead<ProtocolEvent>>;
  /** Acknowledged cancel still requires snapshot reconciliation. */
  cancel(ref: ProtocolTurnRef,
    context: OperationContext): Promise<ProtocolWrite>;
  /** Host must authorize actor/run/turn/request/action before calling. */
  respond(decision: DecisionSubmission,
    context: OperationContext): Promise<ProtocolWrite>;
}
