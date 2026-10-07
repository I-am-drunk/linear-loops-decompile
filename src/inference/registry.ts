/**
 * The provider registry (IN1, docs/plan/inference.md).
 *
 * Holds providers by id and resolves a request to one. It knows nothing about
 * pairing, API keys or base URLs — that asymmetry is the point: adding
 * Anthropic (IN3) or T3 Code Connect (IN4) must not touch this file.
 *
 * Resolution order for an automation, per the plan: the named provider, then
 * its declared fallbacks in order. A fallback is tried only when the previous
 * one FAILED TO BE AVAILABLE — never when it rejected the request on merit,
 * because retrying a refusal elsewhere would launder it.
 */

import { fail, ok, type Outcome, type Provider, type ProviderFailure, type ProviderId } from "./types.ts";

/** Failures where trying a different provider is the right move. */
const isAvailabilityFailure = (e: ProviderFailure): boolean =>
  e.kind === `unavailable` || e.kind === `unconfigured` || e.kind === `rateLimited`;

export type Registry = {
  register(provider: Provider): void;
  list(): Provider[];
  get(id: ProviderId): Outcome<Provider>;
  /** First available provider from `ids`, in order. */
  resolve(ids: readonly ProviderId[]): Promise<Outcome<Provider>>;
};

export function makeRegistry(): Registry {
  /** Insertion-ordered: `list()` is stable, so the settings UI is stable. */
  const providers = new Map<ProviderId, Provider>();

  return {
    register(provider: Provider): void {
      if (providers.has(provider.id)) {
        // Silent replacement would make a double-registration bug invisible
        // until a run picked the wrong one.
        throw new Error(`inference: provider already registered: ${provider.id}`);
      }
      providers.set(provider.id, provider);
    },

    list(): Provider[] {
      return [...providers.values()];
    },

    get(id: ProviderId): Outcome<Provider> {
      const found = providers.get(id);
      return found ? ok(found) : fail({ kind: `unconfigured`, provider: id });
    },

    async resolve(ids: readonly ProviderId[]): Promise<Outcome<Provider>> {
      if (ids.length === 0) {
        return fail({ kind: `unconfigured`, provider: `` });
      }

      // Report the FIRST failure, not the last: the first id is what the
      // automation actually asked for, so that is the useful name in a run
      // record. Later entries are our substitutions, not the user's intent.
      let first: ProviderFailure | undefined;

      for (const id of ids) {
        const got = providers.get(id);
        if (!got) {
          first ??= { kind: `unconfigured`, provider: id };
          continue;
        }
        const live = await got.reachable();
        if (live.ok) return ok(got);
        first ??= live.error;
        // A non-availability failure is about the request, not the provider,
        // so no fallback can fix it.
        if (!isAvailabilityFailure(live.error)) return fail(live.error);
      }

      return fail(first ?? { kind: `unavailable`, provider: ids[0] ?? ``, detail: `no provider resolved` });
    },
  };
}
