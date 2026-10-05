/**
 * The list's data shape and its sort/filter kernel (AU1).
 *
 * Kept apart from rendering so the ordering and matching rules are testable
 * as functions — they carry the behavior a reviewer would otherwise have to
 * read out of markup.
 */

export type RunStatus = `queued` | `running` | `succeeded` | `failed` | `cancelled`;

export type AutomationSummary = {
  id: string;
  name: string;
  enabled: boolean;
  /** Model id as configured; a chain shows its first step's model. */
  model: string;
  createdBy: string;
  /** Tool/MCP server names this automation may call. */
  tools: string[];
  /** How many triggers are attached; the row shows the count, not the detail. */
  triggerCount: number;
  lastRun?: { status: RunStatus; at: string };
};

export type ListQuery = {
  /** Free text over name, model, creator and tool names. */
  search?: string;
  /** `undefined` means both; the UI's third filter state. */
  enabled?: boolean;
  tool?: string;
};

/**
 * Case- and accent-insensitive fold for matching.
 *
 * NFD + combining-mark strip means a search for "deploy" finds "déploy",
 * which is what a user typing ASCII expects. `toLocaleLowerCase` would fold
 * case but leave the accent.
 */
const fold = (s: string): string =>
  s.normalize(`NFD`).replace(/\p{M}/gu, ``).toLowerCase();

/** Every field the search box is documented to cover. */
const haystack = (a: AutomationSummary): string =>
  fold([a.name, a.model, a.createdBy, ...a.tools].join(`\u0000`));

export function matches(a: AutomationSummary, q: ListQuery): boolean {
  if (q.enabled !== undefined && a.enabled !== q.enabled) return false;
  if (q.tool !== undefined && !a.tools.includes(q.tool)) return false;
  const needle = fold((q.search ?? ``).trim());
  if (needle === ``) return true;
  // Every whitespace-separated term must match, so adding a word narrows.
  return needle.split(/\s+/).every((t) => haystack(a).includes(t));
}

/**
 * Natural-numeric name collation: "Deploy 2" sorts before "Deploy 10".
 *
 * `Intl.Collator` with `numeric` does this and respects locale; the repo
 * already relies on exactly this behavior in src/team-tree.
 */
const byName = new Intl.Collator(undefined, { numeric: true, sensitivity: `base` });

/**
 * Enabled rows sort before disabled ones (docs/plan/automations.md), then by
 * name. A stable tiebreak on id keeps the order from shifting between
 * renders when two rows compare equal.
 */
export function sortAutomations(items: readonly AutomationSummary[]): AutomationSummary[] {
  return [...items].sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    const n = byName.compare(a.name, b.name);
    return n !== 0 ? n : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

/** Filter then sort: the documented list for a given query. */
export const listFor = (items: readonly AutomationSummary[], q: ListQuery = {}): AutomationSummary[] =>
  sortAutomations(items.filter((a) => matches(a, q)));
