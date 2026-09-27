/**
 * Scoped session tokens (T-901) — the auth substrate for the connect channel.
 *
 * Shape (SPECS/t3-connect.md §2 + gen-1 security review, hub #21 2026-09-26 23:15Z):
 * - plaintext is `t3_` + 24 random bytes (base64url) — shown to the caller exactly
 *   once at mint; the store keeps ONLY the sha256 hash. A leaked DB or log line
 *   never reveals a usable token.
 * - scopes come from a CLOSED list (below). authorize() fails closed with typed
 *   errors so callers can map them to stable wire codes.
 * - tokens are revocable, optionally expiring, and pairing/device tokens are
 *   one-time (consumed on use).
 *
 * Persistence is injected (TokenPersistence) so src/server (T-1101) owns the
 * SQLite schema; this package stays zero-dep and storage-agnostic.
 *
 * Original code.
 */

import { createHash, randomBytes } from "node:crypto";

/** The closed scope set. Adding a scope is a spec change, not a config change. */
export const SCOPES = [
  "env:read",
  "loops:read",
  "loops:write",
  "runs:read",
  "runs:write",
  "settings:read",
  "settings:write",
] as const;

export type Scope = (typeof SCOPES)[number];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

export function assertScopes(values: string[]): Scope[] {
  if (values.length === 0) throw new Error("token needs at least one scope");
  for (const v of values) {
    if (!isScope(v)) throw new Error(`unknown scope: ${v}`);
  }
  return values as Scope[];
}

export type TokenKind = "session" | "pairing" | "device";

export interface TokenRecord {
  /** Public id (safe to log/show). */
  id: string;
  /** sha256 hex of the plaintext token. The plaintext is never stored. */
  hash: string;
  kind: TokenKind;
  label?: string;
  scopes: Scope[];
  createdAt: number;
  /** Epoch ms, or null for no expiry. */
  expiresAt: number | null;
  /** Epoch ms when revoked, or null. */
  revokedAt: number | null;
  /** Epoch ms when a one-time token was consumed, or null. */
  consumedAt: number | null;
}

export type AuthorizeFailure =
  | "unknown_token"
  | "token_expired"
  | "token_revoked"
  | "token_consumed"
  | "insufficient_scope";

export type AuthorizeResult =
  | { ok: true; record: TokenRecord }
  | { ok: false; error: AuthorizeFailure };

/** Optional persistence seam — implemented by src/server over node:sqlite. */
export interface TokenPersistence {
  put(record: TokenRecord): void;
  loadAll(): TokenRecord[];
}

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export class TokenStore {
  readonly #byHash = new Map<string, TokenRecord>();
  readonly #byId = new Map<string, TokenRecord>();
  readonly #persistence: TokenPersistence | undefined;
  readonly #now: () => number;

  constructor(options: { persistence?: TokenPersistence; now?: () => number } = {}) {
    this.#persistence = options.persistence;
    this.#now = options.now ?? (() => Date.now());
    if (this.#persistence) {
      for (const record of this.#persistence.loadAll()) {
        this.#byHash.set(record.hash, record);
        this.#byId.set(record.id, record);
      }
    }
  }

  /**
   * Mint a token. The returned plaintext is the ONLY copy — it is never stored.
   */
  mint(options: {
    scopes: Scope[];
    kind?: TokenKind;
    label?: string;
    /** Null/omitted = no expiry. */
    ttlMs?: number | null;
  }): { token: string; record: TokenRecord } {
    const scopes = assertScopes(options.scopes);
    const token = "t3_" + randomBytes(24).toString("base64url");
    const createdAt = this.#now();
    const ttlMs = options.ttlMs ?? null;
    const record: TokenRecord = {
      id: randomBytes(9).toString("base64url"),
      hash: hashToken(token),
      kind: options.kind ?? "session",
      scopes: [...scopes],
      createdAt,
      expiresAt: ttlMs === null ? null : createdAt + ttlMs,
      revokedAt: null,
      consumedAt: null,
      ...(options.label !== undefined ? { label: options.label } : {}),
    };
    this.#save(record);
    return { token, record };
  }

  /** Hash lookup without validity checks — for diagnostics/pairing internals. */
  lookup(plaintext: string): TokenRecord | undefined {
    return this.#byHash.get(hashToken(plaintext));
  }

  /** Validity check independent of scopes. Null = valid. */
  checkValidity(record: TokenRecord): AuthorizeFailure | null {
    if (record.revokedAt !== null) return "token_revoked";
    if (record.consumedAt !== null) return "token_consumed";
    if (record.expiresAt !== null && record.expiresAt <= this.#now()) return "token_expired";
    return null;
  }

  authorize(plaintext: string, scope: Scope): AuthorizeResult {
    const record = this.lookup(plaintext);
    if (!record) return { ok: false, error: "unknown_token" };
    const invalid = this.checkValidity(record);
    if (invalid) return { ok: false, error: invalid };
    if (!record.scopes.includes(scope)) return { ok: false, error: "insufficient_scope" };
    return { ok: true, record };
  }

  revoke(id: string): boolean {
    const record = this.#byId.get(id);
    if (!record || record.revokedAt !== null) return false;
    record.revokedAt = this.#now();
    this.#save(record);
    return true;
  }

  /** Mark a one-time token used. Returns false if already consumed/revoked/missing. */
  consume(id: string): boolean {
    const record = this.#byId.get(id);
    if (!record || record.consumedAt !== null || record.revokedAt !== null) return false;
    record.consumedAt = this.#now();
    this.#save(record);
    return true;
  }

  get(id: string): TokenRecord | undefined {
    return this.#byId.get(id);
  }

  /** All records (never plaintext — records hold hashes by construction). */
  list(): TokenRecord[] {
    return [...this.#byId.values()];
  }

  #save(record: TokenRecord): void {
    this.#byHash.set(record.hash, record);
    this.#byId.set(record.id, record);
    this.#persistence?.put(record);
  }
}

