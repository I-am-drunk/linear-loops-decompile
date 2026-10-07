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
  /** Retained for the editor; the desktop list has no model column. */
  model: string;
  createdBy: string;
  createdById?: number;
  /** Relative-time text supplied by the host. */
  createdAtLabel?: string;
  access?: `full` | `limited`;
  hidden?: boolean;
  /** Tool/MCP server names this automation may call. */
  tools: string[];
  /** Editor data; neither triggers nor last run appear in this list variant. */
  triggerCount: number;
  lastRun?: { status: RunStatus; at: string };
};

export type ListQuery = {
  /** Trimmed, case-insensitive substring over name or creator (Cursor DL07). */
  search?: string;
  tab?: `mine` | `team`;
  viewerId?: number;
  page?: number;
};

export function matches(a: AutomationSummary, q: ListQuery): boolean {
  const full = a.access !== `limited`;
  if (full && a.hidden) return false;
  if ((q.tab ?? `mine`) === `mine` &&
      (!full || q.viewerId === undefined || a.createdById !== q.viewerId)) return false;
  const needle = (q.search ?? ``).trim().toLowerCase();
  if (needle === ``) return true;
  return a.name.toLowerCase().includes(needle) || a.createdBy.toLowerCase().includes(needle);
}

/** Cursor 3.23.12 DL08: stable enabled-first partition; retain incoming order. */
export function sortAutomations(items: readonly AutomationSummary[]): AutomationSummary[] {
  return [...items.filter((a) => a.enabled), ...items.filter((a) => !a.enabled)];
}

/** Filter then sort: the documented list for a given query. */
export const listFor = (items: readonly AutomationSummary[], q: ListQuery = {}): AutomationSummary[] =>
  sortAutomations(items.filter((a) => matches(a, q)));

/** Cursor DL08: twenty-five rows per page. Invalid host input resets to page one. */
export const PAGE_SIZE = 25;

export function listPage(items: readonly AutomationSummary[], q: ListQuery = {}): {
  items: AutomationSummary[]; page: number; pages: number; total: number;
} {
  const filtered = listFor(items, q);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const requested = q.page !== undefined && Number.isSafeInteger(q.page) && q.page > 0 ? q.page : 1;
  const page = Math.min(requested, pages);
  return { items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), page, pages, total: filtered.length };
}
