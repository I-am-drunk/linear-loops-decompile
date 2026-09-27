/**
 * Typed errors raised by the inference package.
 *
 * Every failure a caller might reasonably branch on gets its own class so the
 * server layer (src/server) can map them to clean RPC/HTTP responses without
 * string-matching messages.
 */

/** Base class for all inference-package errors. */
export class InferenceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Input failed zod validation. `issues` is a flat, human-readable list. */
export class SettingsValidationError extends InferenceError {
  readonly issues: string[];
  constructor(issues: string[]) {
    super(`invalid harness settings: ${issues.join("; ")}`);
    this.issues = issues;
  }
}

/** No harness exists for the given id or name. */
export class HarnessNotFoundError extends InferenceError {
  constructor(lookup: string) {
    super(`no inference harness found for "${lookup}"`);
  }
}

/** A secret reference does not exist (or was already deleted). */
export class SecretNotFoundError extends InferenceError {
  constructor(ref: string) {
    super(`no stored secret for ref "${ref}"`);
  }
}

/** A stored secret could not be decrypted (wrong master key or tampered row). */
export class SecretUndecryptableError extends InferenceError {
  constructor(ref: string) {
    super(
      `stored secret "${ref}" could not be decrypted — wrong master key or corrupted row`,
    );
  }
}

/**
 * A provider returned a non-2xx response. `status` carries the HTTP code so
 * callers can branch on 401/403 (bad key) vs 429 (rate limit) vs 5xx.
 */
export class AdapterHttpError extends InferenceError {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }

  /** Build from a fetch Response, folding in a short body excerpt for context. */
  static async fromResponse(res: Response, prefix: string): Promise<AdapterHttpError> {
    let excerpt = "";
    try {
      excerpt = (await res.text()).slice(0, 300);
    } catch {
      // body unreadable — status alone still describes the failure
    }
    const hint =
      res.status === 401 || res.status === 403
        ? " (check the harness API key)"
        : res.status === 429
          ? " (provider rate limit — back off)"
          : "";
    return new AdapterHttpError(
      `${prefix}: HTTP ${res.status}${hint}${excerpt ? ` — ${excerpt}` : ""}`,
      res.status,
    );
  }
}

