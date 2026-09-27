/**
 * Typed errors for the Linear data plane.
 *
 * Design notes:
 * - Every failure a caller can reasonably react to gets its own class so
 *   engine/runtime code can branch on `instanceof` instead of parsing text.
 * - Error messages must never contain credential material; `auth.ts` owns
 *   redaction helpers and transport passes messages through them.
 */

/** Machine-readable category, stable across versions — safe to persist in audit logs. */
export type LinearErrorKind =
  | "authentication" // 401 / AUTHENTICATION_ERROR — token invalid or revoked
  | "forbidden" // 403 / FORBIDDEN — token valid, action not allowed
  | "rate_limited" // 429 / RATELIMITED — carries retryAfterMs when known
  | "graphql" // 200 with errors[] — query/variable/validation problems
  | "not_found" // entity lookup came back empty where one was required
  | "server" // 5xx — Linear-side failure, retryable
  | "network" // fetch threw — DNS/TLS/socket, retryable
  | "budget_exhausted" // local rate budget spent and wait would exceed caller's deadline
  | "aborted"; // caller's AbortSignal fired

export interface LinearErrorDetails {
  kind: LinearErrorKind;
  /** HTTP status when a response was received. */
  httpStatus?: number | undefined;
  /** GraphQL `errors[].extensions.code` values seen, when present. */
  graphQLCodes?: string[] | undefined;
  /** How long to wait before retrying, when the server told us (ms since call time). */
  retryAfterMs?: number | undefined;
  /** True when retrying the identical call is expected to succeed eventually. */
  retryable: boolean;
}

export class LinearApiError extends Error {
  readonly kind: LinearErrorKind;
  readonly httpStatus: number | undefined;
  readonly graphQLCodes: string[] | undefined;
  readonly retryAfterMs: number | undefined;
  readonly retryable: boolean;

  constructor(message: string, details: LinearErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.kind = details.kind;
    this.httpStatus = details.httpStatus;
    this.graphQLCodes = details.graphQLCodes;
    this.retryAfterMs = details.retryAfterMs;
    this.retryable = details.retryable;
  }
}

export class AuthenticationError extends LinearApiError {
  constructor(message = "Linear rejected the credential (401). Re-check the API key.") {
    super(message, { kind: "authentication", httpStatus: 401, retryable: false });
  }
}

export class ForbiddenError extends LinearApiError {
  constructor(message = "Linear forbids this action for the current credential (403).") {
    super(message, { kind: "forbidden", httpStatus: 403, retryable: false });
  }
}

export class RateLimitError extends LinearApiError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, {
      kind: "rate_limited",
      httpStatus: 429,
      retryAfterMs,
      retryable: true,
    });
  }
}

/** One entry of a GraphQL `errors` array, reduced to what callers need. */
export interface GraphQLErrorEntry {
  message: string;
  code?: string | undefined; // extensions.code
  path?: (string | number)[] | undefined;
}

export class GraphQLRequestError extends LinearApiError {
  readonly errors: GraphQLErrorEntry[];
  constructor(errors: GraphQLErrorEntry[]) {
    const codes = errors.map((e) => e.code).filter((c): c is string => !!c);
    super(
      `GraphQL request failed: ${errors.map((e) => e.message).join("; ")}`,
      {
        kind: "graphql",
        httpStatus: 200,
        graphQLCodes: codes,
        // Validation/input errors are deterministic; server-flavored codes are not.
        retryable: codes.some((c) => c === "INTERNAL_SERVER_ERROR"),
      },
    );
    this.errors = errors;
  }
}

export class ServerError extends LinearApiError {
  constructor(httpStatus: number, message = `Linear server error (${httpStatus}).`) {
    super(message, { kind: "server", httpStatus, retryable: true });
  }
}

export class NetworkError extends LinearApiError {
  constructor(message: string) {
    super(message, { kind: "network", retryable: true });
  }
}

export class BudgetExhaustedError extends LinearApiError {
  constructor(message: string, retryAfterMs?: number) {
    super(message, { kind: "budget_exhausted", retryAfterMs, retryable: true });
  }
}

export class AbortedError extends LinearApiError {
  constructor(message = "Request aborted by caller.") {
    super(message, { kind: "aborted", retryable: false });
  }
}

