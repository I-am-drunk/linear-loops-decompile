/**
 * Pairing (T-901) — how a UI client earns its first scoped session token.
 *
 * Two flows (SPECS/t3-connect.md §2):
 * 1. Interactive: the server operator (or an already-authed settings UI) creates
 *    a short-lived, one-time pairing offer. The offer renders as a connection
 *    string `loops://pair?url=<base>&token=<t3_…>` — the QR payload is the same
 *    string. The client redeems it for a session token whose scopes are capped
 *    by the offer's scopes.
 * 2. Headless (device flow): a CLI on another machine asks for a device
 *    authorization, shows a short user code, and polls. A human approves the
 *    code in the settings UI; the poller then receives the session token
 *    EXACTLY ONCE (the device code is consumed by delivery).
 *
 * Both flows are built on TokenStore: pairing offers and device codes are
 * one-time tokens (`kind: "pairing" | "device"`), so expiry/revocation/replay
 * handling is uniform.
 *
 * Original code.
 */

import { randomBytes } from "node:crypto";
import { TokenStore } from "./tokens.ts";
import type { Scope, TokenRecord } from "./tokens.ts";

const OFFER_TTL_MS = 5 * 60_000;
const DEVICE_TTL_MS = 10 * 60_000;
const DEVICE_POLL_INTERVAL_MS = 2_000;

/** Human code alphabet: no 0/O, 1/I, or lookalikes. */
const USER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface PairingOffer {
  /** One-time pairing token (plaintext, shown once). */
  token: string;
  /** `loops://pair?url=…&token=…` — QR payload and deep link. */
  connectionString: string;
  scopes: Scope[];
  expiresAt: number;
}

export type RedeemResult =
  | { ok: true; token: string; record: TokenRecord }
  | { ok: false; error: "invalid_pairing_token" | "pairing_expired" | "pairing_consumed" };

export interface DeviceAuthorization {
  /** Secret poller-side code (plaintext, shown once). */
  deviceCode: string;
  /** Short code the human types/approves in the UI, e.g. "ABCD-EFGH". */
  userCode: string;
  expiresAt: number;
  /** Suggested poll interval. */
  intervalMs: number;
}

export type DevicePollResult =
  | { status: "authorization_pending" }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "complete"; token: string; record: TokenRecord };

interface DeviceState {
  tokenId: string;
  userCode: string;
  scopes: Scope[];
  approvedAt: number | null;
}

export class PairingManager {
  readonly #tokens: TokenStore;
  readonly #now: () => number;
  readonly #devicesByCode = new Map<string, DeviceState>(); // key: device token hash id
  readonly #devicesByUserCode = new Map<string, string>(); // userCode -> tokenId

  constructor(tokens: TokenStore, options: { now?: () => number } = {}) {
    this.#tokens = tokens;
    this.#now = options.now ?? (() => Date.now());
  }

  createOffer(options: { url: string; scopes: Scope[]; ttlMs?: number }): PairingOffer {
    const ttlMs = options.ttlMs ?? OFFER_TTL_MS;
    const { token, record } = this.#tokens.mint({
      kind: "pairing",
      scopes: options.scopes,
      ttlMs,
      label: "pairing offer",
    });
    const connectionString =
      `loops://pair?url=${encodeURIComponent(options.url)}&token=${encodeURIComponent(token)}`;
    return { token, connectionString, scopes: record.scopes, expiresAt: record.expiresAt ?? 0 };
  }

  /**
   * Exchange a one-time pairing token for a session token. The session token's
   * scopes are the offer's scopes intersected with the requested set (when
   * given) — a client can narrow, never widen.
   */
  redeem(pairingToken: string, requestedScopes?: Scope[]): RedeemResult {
    const offer = this.#tokens.lookup(pairingToken);
    if (!offer || offer.kind !== "pairing") return { ok: false, error: "invalid_pairing_token" };
    if (offer.revokedAt !== null) return { ok: false, error: "invalid_pairing_token" };
    if (offer.consumedAt !== null) return { ok: false, error: "pairing_consumed" };
    if (offer.expiresAt !== null && offer.expiresAt <= this.#now()) {
      return { ok: false, error: "pairing_expired" };
    }
    const scopes =
      requestedScopes === undefined
        ? offer.scopes
        : offer.scopes.filter((s) => requestedScopes.includes(s));
    if (scopes.length === 0) return { ok: false, error: "invalid_pairing_token" };
    if (!this.#tokens.consume(offer.id)) return { ok: false, error: "pairing_consumed" };
    const session = this.#tokens.mint({ kind: "session", scopes, label: "paired session" });
    return { ok: true, token: session.token, record: session.record };
  }

  createDeviceAuthorization(options: { scopes: Scope[]; ttlMs?: number }): DeviceAuthorization {
    const ttlMs = options.ttlMs ?? DEVICE_TTL_MS;
    const { token, record } = this.#tokens.mint({
      kind: "device",
      scopes: options.scopes,
      ttlMs,
      label: "device authorization",
    });
    const userCode = generateUserCode();
    this.#devicesByCode.set(record.id, {
      tokenId: record.id,
      userCode,
      scopes: record.scopes,
      approvedAt: null,
    });
    this.#devicesByUserCode.set(userCode, record.id);
    return {
      deviceCode: token,
      userCode,
      expiresAt: record.expiresAt ?? 0,
      intervalMs: DEVICE_POLL_INTERVAL_MS,
    };
  }

  /** Human-side approval (settings UI). Returns false for unknown codes. */
  approveDevice(userCode: string): boolean {
    const tokenId = this.#devicesByUserCode.get(normalizeUserCode(userCode));
    if (!tokenId) return false;
    const state = this.#devicesByCode.get(tokenId);
    if (!state) return false;
    state.approvedAt = this.#now();
    return true;
  }

  /**
   * Poller-side exchange. Delivers the session token EXACTLY ONCE: a second
   * poll after delivery is `invalid` (the device code was consumed), so a
   * stolen device code is useless after the real client polled.
   */
  pollDeviceToken(deviceCode: string): DevicePollResult {
    const record = this.#tokens.lookup(deviceCode);
    if (!record || record.kind !== "device") return { status: "invalid" };
    if (record.expiresAt !== null && record.expiresAt <= this.#now()) return { status: "expired" };
    if (record.revokedAt !== null) return { status: "invalid" };
    if (record.consumedAt !== null) return { status: "invalid" };
    const state = this.#devicesByCode.get(record.id);
    if (!state || state.approvedAt === null) return { status: "authorization_pending" };
    if (!this.#tokens.consume(record.id)) return { status: "invalid" };
    const session = this.#tokens.mint({
      kind: "session",
      scopes: state.scopes,
      label: "device session",
    });
    this.#devicesByUserCode.delete(state.userCode);
    this.#devicesByCode.delete(record.id);
    return { status: "complete", token: session.token, record: session.record };
  }
}

function generateUserCode(): string {
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += USER_CODE_ALPHABET[bytes[i]! % USER_CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

function normalizeUserCode(code: string): string {
  return code.trim().toUpperCase();
}

