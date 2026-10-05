/**
 * The Linear Integration (IG6, docs/plan/integrations.md).
 *
 * Assembly, not new logic: IG2 (auth), IG3 (entities), IG4 (webhook kinds)
 * and IG5 (actions) become one `Integration` the IG1 registry can hold.
 * Registering it is what makes `linear:issue.update` appear in the trigger
 * catalog and `linear:comment` in the action catalog — the automations page
 * never learns what Linear is.
 *
 * Which events are `webhook` and which are `poll` is a FACT about Linear,
 * read from extracts/linear-official/docs-site/webhooks.md: data-change
 * webhooks exist for issues, projects, documents, initiatives and cycles,
 * but no webhook action fires at a cycle's start or end, so those two are
 * polled against our own clock.
 */

import type { Integration, IntegrationEvent, IntegrationStatus } from "../integrations/types.ts";
import { LINEAR_ACTIONS } from "./actions.ts";
import { LINEAR_ENTITIES } from "./entities.ts";

/** Entities whose data-change webhooks webhooks.md lists, that we model. */
const WEBHOOK_ENTITIES = [`issue`, `project`, `document`, `initiative`, `cycle`] as const;

/** Every webhook body carries `webhookId`; IG4 dedupes on the Linear-Delivery header, surfaced under this key. */
const DEDUPE_KEY = `deliveryId`;

/** create/update/remove for each webhook-backed entity, plus the two polled cycle boundaries. */
export function linearEvents(): IntegrationEvent[] {
  const changes: IntegrationEvent[] = WEBHOOK_ENTITIES.flatMap((entity) =>
    ([`create`, `update`, `remove`] as const).map((action): IntegrationEvent => ({
      kind: `${entity}.${action}`,
      // "Issue created" / "Issue updated" / "Issue removed" — `remove` takes a d, not an ed.
      label: `${entity[0]?.toUpperCase()}${entity.slice(1)} ${action === `remove` ? `removed` : `${action}d`}`,
      entity,
      delivery: `webhook`,
      dedupeKey: DEDUPE_KEY,
      payload: [
        { name: `id`, type: `string`, required: true },
        ...(action === `update` ? [{ name: `updatedFrom`, type: `string` as const }] : []),
      ],
    })),
  );
  // No webhook action fires at a cycle boundary (webhooks.md), so these are
  // ours to detect against our own clock. The scheduler reads `poll`.
  const polled: IntegrationEvent[] = [`started`, `ended`].map((edge) => ({
    kind: `cycle.${edge}`, label: `Cycle ${edge}`, entity: `cycle`, delivery: `poll`,
    dedupeKey: `cycleId`, payload: [{ name: `cycleId`, type: `string`, required: true }],
  }));
  return [...changes, ...polled];
}

export type LinearIntegrationDeps = {
  /** IG2's status(), already refresh-aware; or IG3's reachable() once probed. */
  status: () => Promise<IntegrationStatus>;
  scopes: readonly string[];
};

/**
 * Status is read live through a function, never captured. The `Integration`
 * type's status() is synchronous, so the async source is sampled: callers
 * that need the probe to run first await `refresh()`, and status() returns
 * the last sampled value — `checking` until the first sample lands.
 */
export function makeLinearIntegration(deps: LinearIntegrationDeps): Integration & { refresh(): Promise<IntegrationStatus> } {
  let last: IntegrationStatus = { state: `checking` };
  return {
    id: `linear`,
    name: `Linear`,
    auth: { kind: `oauth2`, scopes: deps.scopes },
    status: () => last,
    entities: LINEAR_ENTITIES,
    events: linearEvents(),
    actions: LINEAR_ACTIONS,
    async refresh() { last = await deps.status(); return last; },
  };
}
