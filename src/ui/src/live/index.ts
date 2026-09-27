/**
 * T-1104 — live-data barrel. The M5 "visible in UI run history" leg:
 * containers + sources + mappers wire the loops/runs pages to the loops
 * server over the T3 connect channel; fixtures remain the offline fallback.
 */
export { RPC } from "./contract.ts";
export type {
  WireLoop,
  WireRun,
  WireRunEvent,
  WireTurn,
  LoopsListResult,
  LoopsGetParams,
  LoopsGetResult,
  LoopsUpsertParams,
  LoopsUpsertResult,
  LoopsPublishParams,
  LoopsSetEnabledParams,
  RunsListParams,
  RunsListResult,
  RunsGetParams,
  RunsGetResult,
  RunsTextParams,
  RunsCancelParams,
} from "./contract.ts";
export {
  wireLoopToSummary,
  wireRunToSummary,
  wireRunToDetail,
  turnsToActivities,
  createRunDetailReducer,
} from "./mappers.ts";
export type { RunDetailReducer } from "./mappers.ts";
export { resolveConnectConfig, getSharedClient, resetSharedClientForTests, TOKEN_STORAGE_KEY } from "./client.ts";
export type { ConnectConfig } from "./client.ts";
export {
  LiveLoopsSource,
  LiveRunsSource,
  FixtureLoopsSource,
  FixtureRunsSource,
  selectSources,
} from "./sources.ts";
export type { ChannelRpc, EditorLoopRecord, LoopsSource, RunsSource, Sources } from "./sources.ts";
export { EditorContainer } from "./editor.tsx";
export type { EditorContainerProps } from "./editor.tsx";
export { LoopsListContainer, RunsListContainer, RunDetailContainer } from "./containers.tsx";
export type {
  LoopsListContainerProps,
  RunsListContainerProps,
  RunDetailContainerProps,
} from "./containers.tsx";
