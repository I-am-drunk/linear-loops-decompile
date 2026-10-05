/**
 * The integration registry (IG1, docs/plan/integrations.md).
 *
 * Holds integrations by id and projects two catalogs out of them: the
 * TRIGGER catalog (every event any integration offers) and the ACTION
 * catalog (every action). The automations page reads the catalogs and never
 * the integrations, which is what keeps it vendor-blind.
 *
 * Mirrors src/inference's registry on purpose: same register/list/get shape,
 * same throw-on-duplicate, so a reader of one already knows the other.
 */

import {
  type CatalogAction,
  type CatalogTrigger,
  type Integration,
  type IntegrationId,
  catalogKey,
} from "./types.ts";

export type IntegrationRegistry = {
  register(integration: Integration): void;
  list(): Integration[];
  get(id: IntegrationId): Integration | undefined;
  /** Every event from every integration, each tagged with its source. */
  triggers(): CatalogTrigger[];
  /** Every action from every integration, each tagged with its source. */
  actions(): CatalogAction[];
};

export function makeIntegrationRegistry(): IntegrationRegistry {
  /** Insertion-ordered, so the settings list and catalogs are stable. */
  const byId = new Map<IntegrationId, Integration>();

  return {
    register(integration: Integration): void {
      if (byId.has(integration.id)) {
        // Silent replacement would hide a double-registration until a
        // trigger fired against the wrong integration.
        throw new Error(`integrations: already registered: ${integration.id}`);
      }
      byId.set(integration.id, integration);
    },

    list: () => [...byId.values()],
    get: (id) => byId.get(id),

    triggers(): CatalogTrigger[] {
      return [...byId.values()].flatMap((i) =>
        i.events.map((e) => ({ ...e, integration: i.id, key: catalogKey(i.id, e.kind) })),
      );
    },

    actions(): CatalogAction[] {
      return [...byId.values()].flatMap((i) =>
        i.actions.map((a) => ({ ...a, integration: i.id, key: catalogKey(i.id, a.kind) })),
      );
    },
  };
}
