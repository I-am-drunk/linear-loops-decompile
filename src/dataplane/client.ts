/**
 * LinearClient — the façade everything above the dataplane uses.
 *
 * Scope discipline (T-301): this is the transport-level client — auth,
 * budgeting, retries, fixtures. Typed read/write operations for loops
 * (issues, comments, projects, …) are T-302 and build on `client.request`.
 *
 * Included here, because the settings flow needs them day one
 * (target-architecture §settings "Connect Linear"):
 * - `verifyAuth()` — the `viewer` round-trip that validates a pasted PAT and
 *   identifies the user it acts as.
 * - `rateBudget()` — live budget snapshot for the settings UI's budget meter.
 */

import { RateBudget, type RateBudgetSnapshot } from "./rateBudget.js";
import {
  HttpTransport,
  type ExecuteOptions,
  type GraphQLRequest,
  type Transport,
  type TransportEvent,
} from "./transport.js";
import type { LinearCredential } from "./auth.js";

export interface LinearClientOptions {
  credential: LinearCredential;
  endpoint?: string;
  budget?: RateBudget;
  onEvent?: (e: TransportEvent) => void;
  fetchImpl?: typeof fetch;
  userAgent?: string;
}

/** Who the credential acts as — the payload of the `viewer` query. */
export interface Viewer {
  id: string;
  name: string;
  displayName?: string;
  email: string;
}

const VIEWER_QUERY = /* GraphQL */ `
  query VerifyCredential {
    viewer {
      id
      name
      displayName
      email
    }
  }
`;

export class LinearClient {
  private readonly transport: Transport;

  /**
   * Pass an existing `Transport` to get fixture mode or a batching wrapper;
   * otherwise an HttpTransport is built from the credential.
   */
  constructor(options: LinearClientOptions | { transport: Transport }) {
    this.transport =
      "transport" in options ? options.transport : new HttpTransport(options);
  }

  /** Run one GraphQL operation. Reads are retried; writes need `idempotent: true`. */
  async request<T>(
    query: string,
    variables?: Record<string, unknown>,
    opts: ExecuteOptions & { operationName?: string } = {},
  ): Promise<T> {
    const req: GraphQLRequest = {
      query,
      ...(variables !== undefined ? { variables } : {}),
      ...(opts.operationName !== undefined ? { operationName: opts.operationName } : {}),
    };
    return this.transport.execute<T>(req, opts);
  }

  /**
   * Validate the credential and learn who it acts as. Used by the settings
   * "Connect Linear" flow immediately after the user pastes a PAT.
   * Throws AuthenticationError on a bad key — that IS the verification.
   */
  async verifyAuth(): Promise<Viewer> {
    const data = await this.request<{ viewer: Viewer }>(
      VIEWER_QUERY,
      {},
      { operationName: "VerifyCredential" },
    );
    return data.viewer;
  }

  /** Budget snapshot for UI/audit; null when the transport has no budget (fixtures). */
  rateBudget(): RateBudgetSnapshot | null {
    if (this.transport instanceof HttpTransport) {
      return this.transport.rateBudget.snapshot();
    }
    return null;
  }
}



