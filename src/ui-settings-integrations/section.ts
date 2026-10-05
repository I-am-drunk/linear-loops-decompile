/**
 * The Integrations settings section (ST4, docs/plan/settings.md).
 *
 * Assembly, not new UI: an Integration from src/integrations becomes rows
 * that src/ui-settings already renders. Same shape as ST3's provider
 * mapping on purpose, so a reader of one knows the other.
 *
 * The one judgement here is which rows an auth kind gets. A pairing
 * integration stores no credential, so offering it a credential row would
 * invite configuring something that does not exist — the same rule ST3
 * applies to T3 Code Connect.
 */

import type { Integration, IntegrationStatus } from "../integrations/types.ts";
import type { ConnectionState, Row, Section } from "../ui-settings/rows.ts";

/** Map the integration's status onto the connection row's state + detail. */
function connection(i: Integration): Row & { kind: `connection` } {
  const s: IntegrationStatus = i.status();
  const state: ConnectionState = s.state;
  const detail =
    s.state === `connected` ? s.account
      : s.state === `error` ? s.detail
        : s.state === `disconnected` ? `Not connected`
          : undefined;
  return {
    kind: `connection`,
    id: `${i.id}.connection`,
    label: i.name,
    state,
    ...(detail === undefined ? {} : { detail }),
  };
}

/** Rows for one integration: connection first, then what its auth needs. */
export function rowsForIntegration(i: Integration): Row[] {
  const rows: Row[] = [connection(i)];

  if (i.auth.kind === `token`) {
    rows.push({
      kind: `credential`,
      id: `${i.id}.token`,
      label: `Access token`,
      description: `Write-only. Stored encrypted; never shown again.`,
      configured: i.status().state !== `disconnected`,
    });
  }
  // oauth2 shows what it will ask for; the flow itself is IG2.
  // pairing gets nothing extra: there is no credential to configure.
  if (i.auth.kind === `oauth2`) {
    rows.push({
      kind: `text`,
      id: `${i.id}.scopes`,
      label: `Scopes`,
      value: i.auth.scopes.join(` `),
      disabled: true,
    });
  }
  return rows;
}

/** Catalog counts, so the section says what connecting actually unlocks. */
function blurbFor(i: Integration): string {
  const t = i.events.length;
  const a = i.actions.length;
  const part = (n: number, word: string): string => `${n} ${word}${n === 1 ? `` : `s`}`;
  return `${part(t, `trigger`)} · ${part(a, `action`)}`;
}

/** One section per integration, in registry order. */
export const sectionsFor = (integrations: readonly Integration[]): Section[] =>
  integrations.map((i) => ({
    id: i.id,
    title: i.name,
    blurb: blurbFor(i),
    rows: rowsForIntegration(i),
  }));

export const integrationsPage = (integrations: readonly Integration[]) => ({
  id: `integrations`,
  title: `Integrations`,
  sections: sectionsFor(integrations),
});
