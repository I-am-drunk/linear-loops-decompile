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
import type { Page, Row, Section } from "../ui-settings/rows.ts";

/** What the section needs to know about one provider. */
export type ProviderView = {
  id: ProviderId;
  label: string;
  auth: AuthKind;
  credential: CredentialStatus;
  /** Public endpoint snapshot; credentials are kept separate by the caller. */
  baseUrl?: string;
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
  // A probe describes connectivity. Endpoint-only and compatible providers
  // may legitimately have no key; credential presence cannot replace a probe.
  const state = p.reachable === undefined
    ? (p.auth === `apiKey` && !p.credential.configured ? `disconnected` : `checking`)
    : (p.reachable ? `connected` : `error`);

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
 * Pairing providers use the connection action rather than an API-key field.
 * This is our local auth-kind contract; external pairing behavior and token
 * storage are provider-specific and require separate verification.
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
      value: p.baseUrl ?? ``,
      placeholder: `https://api.example.com/v1`,
    });
  }

  // Preserve the stored choice, including a model missing from discovery.
  // A native select otherwise displays its first option as an invented default.
  const selected = p.selectedModel ?? ``;
  if (p.models.length > 0 || selected !== ``) {
    const options = [
      { value: ``, label: `No default model` },
      ...p.models.map((m) => ({ value: m.id, label: m.label })),
    ];
    if (selected !== `` && !options.some((option) => option.value === selected)) {
      options.push({ value: selected, label: `${selected} (not listed)` });
    }
    rows.push({
      kind: `select`,
      id: `${p.id}.model`,
      label: `Default model`,
      value: selected,
      options,
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
      ? { blurb: `Use the provider's pairing flow to connect.` }
      : {}),
    rows: rowsForProvider(p),
  }));

/** The whole page, for the settings shell's `renderPage`. */
export const inferencePage = (providers: readonly ProviderView[]): Page => ({
  id: `inference`,
  title: `Inference`,
  sections: sectionsFor(providers),
});
