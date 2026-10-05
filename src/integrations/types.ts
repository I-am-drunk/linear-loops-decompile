/**
 * The integration interface (IG1, docs/plan/integrations.md).
 *
 * Linear is ONE integration, not the foundation. An integration contributes
 * three things and nothing else:
 *
 *   1. Entities we can read (issues, projects, channels, repos).
 *   2. Events that can trigger an automation.
 *   3. Actions an automation can take (comment, update, send).
 *
 * The automations page does not know what Linear is; it knows there are
 * integrations that offer triggers and actions. So nothing in this file
 * names a vendor, and adding GitHub or Slack must not touch it.
 */

export type IntegrationId = string;

/** How an integration authenticates. Pairing is the T3 Code Connect shape. */
export type IntegrationAuth =
  | { kind: `oauth2`; scopes: readonly string[] }
  | { kind: `token` }
  | { kind: `pairing` };

/**
 * Connection status, as the settings UI shows it.
 *
 * `checking` is the honest state before any probe has run — not
 * `disconnected`, which would claim a failed check that never happened.
 */
export type IntegrationStatus =
  | { state: `disconnected` }
  | { state: `checking` }
  | { state: `connected`; account?: string }
  | { state: `error`; detail: string };

/** A field on an entity, enough for a trigger filter or an action input. */
export type FieldSpec = {
  name: string;
  type: `string` | `number` | `boolean` | `enum` | `ref`;
  /** For `enum`: the allowed values. For `ref`: the entity kind referred to. */
  of?: readonly string[] | string;
  required?: boolean;
};

export type EntityKind = string;

/** Something we can read from the service. */
export type IntegrationEntity = {
  kind: EntityKind;
  label: string;
  fields: readonly FieldSpec[];
};

/**
 * Something that happened in the service, which may fire an automation.
 *
 * `delivery` is a fact about the integration, not a preference: Linear
 * pushes webhooks for issues and cannot push cycle boundaries, so the latter
 * is `poll`. The scheduler reads this to know which events it must go and
 * ask for. At-least-once webhook delivery makes `dedupeKey` mandatory, not an
 * optimization (docs/plan/integrations.md).
 */
export type IntegrationEvent = {
  kind: string;
  label: string;
  entity: EntityKind;
  delivery: `webhook` | `poll`;
  /** Which payload field uniquely identifies a delivery, for dedupe. */
  dedupeKey: string;
  payload: readonly FieldSpec[];
};

/** Something an automation can do to the service. */
export type IntegrationAction = {
  kind: string;
  label: string;
  entity?: EntityKind;
  inputs: readonly FieldSpec[];
  /** Whether running it twice with the same inputs is safe. */
  idempotent: boolean;
};

export type Integration = {
  id: IntegrationId;
  name: string;
  auth: IntegrationAuth;
  status(): IntegrationStatus;
  entities: readonly IntegrationEntity[];
  events: readonly IntegrationEvent[];
  actions: readonly IntegrationAction[];
};

/**
 * Catalog rows. Each is an event or action TAGGED with its source, because
 * two integrations may both offer `issue.updated`. The key is what the
 * automations page stores; the label is what it shows.
 */
export type CatalogTrigger = IntegrationEvent & { integration: IntegrationId; key: string };
export type CatalogAction = IntegrationAction & { integration: IntegrationId; key: string };

/** `linear:issue.updated` — unambiguous across integrations, stable to store. */
export const catalogKey = (integration: IntegrationId, kind: string): string =>
  `${integration}:${kind}`;
