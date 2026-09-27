/**
 * src/dataplane — public surface (T-301).
 *
 * Boundary: this package owns TRANSPORT to Linear's public API. Domain entity
 * types (Issue, Comment, WorkflowDefinition, …) belong to src/model (R2);
 * typed read/write ops belong to T-302 and import from here.
 */

export { LinearClient, type LinearClientOptions, type Viewer } from "./client.js";
export {
  HttpTransport,
  DEFAULT_ENDPOINT,
  parseRateHeaders,
  retryDelayMs,
  type Transport,
  type GraphQLRequest,
  type ExecuteOptions,
  type TransportEvent,
  type HttpTransportOptions,
} from "./transport.js";
export {
  RateBudget,
  type RateBudgetOptions,
  type RateBudgetSnapshot,
} from "./rateBudget.js";
export {
  type LinearCredential,
  type PatCredential,
  type OAuthCredential,
  CredentialStore,
  authorizationHeader,
  redactSecrets,
} from "./auth.js";
export {
  LinearApiError,
  AuthenticationError,
  ForbiddenError,
  RateLimitError,
  GraphQLRequestError,
  ServerError,
  NetworkError,
  BudgetExhaustedError,
  AbortedError,
  type LinearErrorKind,
  type GraphQLErrorEntry,
} from "./errors.js";
export {
  paginate,
  collect,
  type Connection,
  type Page,
} from "./pagination.js";
export {
  listTeams,
  listWorkflowStates,
  listLabels,
  listCycles,
  listProjects,
  getIssue,
  listIssues,
  listComments,
  type TeamRef,
  type WorkflowState,
  type IssueLabel,
  type Cycle,
  type Project,
  type IssueSummary,
  type IssueComment,
  type IssueFilter,
} from "./reads.js";
export {
  FixtureTransport,
  createDemoWorkspace,
  failureFixtures,
  UnmatchedFixtureError,
  type Fixture,
  type FixtureResponse,
  type RecordedCall,
} from "./fixtures.js";

