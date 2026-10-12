/** Compile-only regression checks; emits no implementation or live calls. */
import type { ChatResult, ProviderFailure } from "./types.ts";
import type {
  Measurement, ProtocolAdapter, ProtocolConnection, ProtocolWrite,
  TurnSnapshot, TurnState,
} from "./protocol.ts";

type Assert<T extends true> = T;
type NotAssignable<A, B> = [A] extends [B] ? false : true;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

export type UnknownUsageIsNotZero = Assert<NotAssignable<
  { known: false; value?: never }, { known: true; value: number }
>>;
export type UnknownCostHasNoValue = Assert<Equal<
  keyof Extract<Measurement<number>, { known: false }>, "known"
>>;
export type UncertainWriteCannotUseOldFallback = Assert<NotAssignable<
  Extract<ProtocolWrite, { state: "indeterminate" }>, ProviderFailure
>>;
export type SuspensionIsNotTextSuccess = Assert<NotAssignable<
  Extract<TurnState, { kind: "suspended" }>, ChatResult
>>;
export type SnapshotIsNotLegacySuccess = Assert<NotAssignable<TurnSnapshot, ChatResult>>;
export type TerminalNeedsCorrelation = Assert<NotAssignable<
  { kind: "completed" }, TurnState
>>;
export type ConnectionHasNoRawCredential = Assert<Equal<
  Extract<keyof ProtocolConnection, "token" | "cookie" | "authorization">, never
>>;
export type SharedPreparationType = Assert<Equal<
  ReturnType<ProtocolAdapter["prepare"]>,
  { ok: true; value: Parameters<ProtocolAdapter["send"]>[1] }
    | { ok: false; error: Extract<ProtocolWrite, { state: "not-dispatched" }>["error"] }
>>;
