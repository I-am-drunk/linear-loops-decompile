/**
 * @loops/connect — T3-style UI ↔ server transport (R9).
 * T-901: descriptor + pairing + scoped tokens. T-902: WS RPC channel + client.
 * See README.md for the concept → spec map and the wire protocol.
 */

export { SCOPES, isScope, assertScopes, TokenStore, hashToken } from "./tokens.ts";
export type {
  Scope,
  TokenKind,
  TokenRecord,
  AuthorizeFailure,
  AuthorizeResult,
  TokenPersistence,
} from "./tokens.ts";

export { PairingManager } from "./pairing.ts";
export type { PairingOffer, RedeemResult, DeviceAuthorization, DevicePollResult } from "./pairing.ts";

export { createEnvironmentHandler, generateEnvironmentId } from "./descriptor.ts";
export type { EnvironmentDescriptor } from "./descriptor.ts";

export { WsConnection, checkUpgrade, acceptWebSocketKey, CLOSE_CODES } from "./ws.ts";
export type { UpgradeCheck, WsConnectionOptions } from "./ws.ts";

export { RpcEngine, RpcError, RPC_ERRORS, notification } from "./rpc.ts";
export type { RpcRequest, RpcNotification, RpcInbound, RpcHandler } from "./rpc.ts";

export { ChannelServer, METHOD_SCOPES } from "./channel.ts";
export type {
  ChannelOptions,
  ChannelContext,
  RunRegistry,
  RuntimeCommands,
  RunEventPayload,
} from "./channel.ts";

export { ChannelClient } from "./client.ts";
export type { ChannelClientOptions, SubscribeResult } from "./client.ts";

