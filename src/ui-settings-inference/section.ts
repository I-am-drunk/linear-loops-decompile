/**
 * The Inference settings section (ST3).
 *
 * Assembly, not new UI. A provider becomes rows that `src/ui-settings`
 * already knows how to render, so this file holds the MAPPING and nothing
 * else — no markup, no DOM, no network.
 *
 * The mapping is the interesting part, because `AuthKind` decides which rows
 * a provider even has: T3 Code Connect pairs rather than taking a key, so
 * offering it an API-key field would be wrong, not merely redundant.
 */

import type { AuthKind, CredentialStatus, Model, ProviderId } from "../inference/types.ts";
import type { Row, Section } from "../ui-settings/rows.ts";

/** What the section needs to know about one provider. */
export type ProviderView = {
  id: ProviderId;
  label: string;
  auth: AuthKind;
  credential: CredentialStatus;
  /** Absent until a reachability check has run. */
  reachable?: boolean;
  /** Empty until models have been fetched. */
  models: Model[];
  /** The model this provider will use, when chosen. */
  selectedModel?: string;
};

/**
 * Connection state for a provider's `connection` row.
 *
 * `checking` is the honest state before a reachability result exists — not
 * `disconnected`, which would claim a failed check that never ran.
 */
function connectionState(p: ProviderView): Row & { kind: `connection` } {
  const state =
    !p.credential.configured && p.auth !== `pairing`
      ? `disconnected` as const
      : p.reachable === undefined
        ? `checking` as const
        : p.reachable
          ? `connected` as const
          : `error` as const;

  const detail =
    state === `connected` && p.models.length > 0
      ? `${p.models.length} ${p.models.length === 1 ? `model` : `models`}`
      : state === `disconnected`
        ? `No credentials`
        : undefined;

  return {
    kind: `connection`,
    id: `${p.id}.connection`,
    label: p.label,
    state,
    ...(detail === undefined ? {} : { detail }),
  };
}

/** Human label for the credential a given auth kind needs. */
const CREDENTIAL_LABEL: Record<AuthKind, string> = {
  apiKey: `API key`,
  apiKeyWithBaseUrl: `API key`,
  baseUrl: `Base URL`,
  pairing: `Pairing`,
};

/**
 * Rows for one provider.
 *
 * Pairing providers get NO credential row. T3 Code Connect exchanges a scoped
 * token through `src/connect` and no long-lived key is ever stored, so a
 * "Set API key" control would invite the user to configure something that
 * does not exist. `docs/plan/inference.md` is explicit that this is the
 * point of pairing, not an implementation detail.
 */
export function rowsForProvider(p: ProviderView): Row[] {
  const rows: Row[] = [connectionState(p)];

  // `baseUrl` providers are excluded too, for a different reason than
  // pairing: a base URL is not a secret, so the write-only credential
  // pattern is the wrong control for it. It gets the text row below. Without
  // this, a local provider rendered TWO rows both labelled "Base URL", one
  // of them masking a value that was never sensitive.
  if (p.auth !== `pairing` && p.auth !== `baseUrl`) {
    rows.push({
      kind: `credential`,
      id: `${p.id}.credential`,
      label: CREDENTIAL_LABEL[p.auth],
      configured: p.credential.configured,
      ...(p.credential.hint === undefined ? {} : { hint: p.credential.hint }),
    });
  }

  if (p.auth === `apiKeyWithBaseUrl` || p.auth === `baseUrl`) {
    rows.push({
      kind: `text`,
      id: `${p.id}.baseUrl`,
      label: `Base URL`,
      description: `OpenAI-compatible endpoint.`,
      value: ``,
      placeholder: `https://api.example.com/v1`,
    });
  }

  // The model select appears only once models are known. An empty select is
  // a dead control that looks enabled; a missing one reads as "not yet".
  if (p.models.length > 0) {
    rows.push({
      kind: `select`,
      id: `${p.id}.model`,
      label: `Default model`,
      value: p.selectedModel ?? p.models[0]?.id ?? ``,
      options: p.models.map((m) => ({ value: m.id, label: m.label })),
    });
  }

  return rows;
}

/** One section per provider, in registry order. */
export const sectionsFor = (providers: readonly ProviderView[]): Section[] =>
  providers.map((p) => ({
    id: p.id,
    title: p.label,
    ...(p.auth === `pairing`
      ? { blurb: `Paired, not keyed — no credential is stored here.` }
      : {}),
    rows: rowsForProvider(p),
  }));

/** The whole page, for the settings shell's `renderPage`. */
export const inferencePage = (providers: readonly ProviderView[]) => ({
  id: `inference`,
  title: `Inference`,
  sections: sectionsFor(providers),
});
