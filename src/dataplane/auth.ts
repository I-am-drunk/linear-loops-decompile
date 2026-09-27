/**
 * Credential model for the Linear data plane.
 *
 * Two credential flavors (KNOWLEDGE.md §6):
 * - PAT  — personal API key from Linear Settings → API. Sent as the raw
 *   `Authorization: <key>` value (no scheme prefix). Acts as the owning user.
 * - OAuth — OAuth2 access token. Sent as `Authorization: Bearer <token>`.
 *
 * House rules (target-architecture §settings):
 * - Secrets are write-only: they flow into the `Authorization` header and
 *   nowhere else — never into logs, errors, audit rows, or serialized state.
 * - `redactSecrets` is the single choke point that scrubs a token out of any
 *   text before it can be surfaced.
 */

export interface PatCredential {
  kind: "pat";
  /** The raw personal API key (e.g. `lin_api_…`). Stored hashed upstream; here it lives only in memory. */
  token: string;
}

export interface OAuthCredential {
  kind: "oauth";
  accessToken: string;
  /**
   * Optional refresh hook. The transport calls it once after a 401 and retries
   * the request with the fresh token. Return null to give up (caller gets
   * AuthenticationError).
   */
  refresh?: () => Promise<{ accessToken: string } | null>;
}

export type LinearCredential = PatCredential | OAuthCredential;

/** Build the exact Authorization header value for a credential. */
export function authorizationHeader(cred: LinearCredential): string {
  return cred.kind === "pat" ? cred.token : `Bearer ${cred.accessToken}`;
}

/** Every secret string this credential can leak, for redaction. */
function secretStrings(cred: LinearCredential): string[] {
  return cred.kind === "pat" ? [cred.token] : [cred.accessToken];
}

/**
 * Replace any occurrence of the credential's secrets in `text` with `***`.
 * Transport and client run all outbound-facing text (error messages, hook
 * payloads) through this before surfacing it.
 */
export function redactSecrets(cred: LinearCredential, text: string): string {
  let out = text;
  for (const secret of secretStrings(cred)) {
    if (secret.length === 0) continue;
    out = out.split(secret).join("***");
  }
  return out;
}

/**
 * A mutable holder so an OAuth refresh can swap the access token without the
 * client re-construction dance. Workers may also construct credentials once
 * and never mutate — refresh is opt-in.
 */
export class CredentialStore {
  private current: LinearCredential;

  constructor(initial: LinearCredential) {
    this.current = initial;
  }

  get credential(): LinearCredential {
    return this.current;
  }

  header(): string {
    return authorizationHeader(this.current);
  }

  redact(text: string): string {
    return redactSecrets(this.current, text);
  }

  /**
   * Attempt exactly one refresh. Returns true when a new token is in place.
   * Only meaningful for OAuth credentials with a `refresh` hook; PATs cannot
   * be refreshed and always return false.
   */
  async refresh(): Promise<boolean> {
    if (this.current.kind !== "oauth" || !this.current.refresh) return false;
    const next = await this.current.refresh();
    if (!next) return false;
    this.current = { ...this.current, accessToken: next.accessToken };
    return true;
  }
}

