/** Cursor desktop list. References and remaining gaps: UI-REFERENCE.md. */
import { esc } from "../ui-settings/render.ts";
import type { AutomationSummary, ListQuery } from "./model.ts";
import { listPage } from "./model.ts";
const attr = (name: string, value: string): string => `${name}="${esc(value)}"`;
export const DESCRIPTION = `Automate repetitive tasks with always-on agents and configure Cursor's built-in agents for your team.`;
export const ROW_ACTIONS = [
  { act: `edit`, label: `Edit Details` },
  { act: `duplicate`, label: `Duplicate` },
  { act: `copyJson`, label: `Copy as JSON` },
  { act: `delete`, label: `Delete`, confirm: true },
] as const;
export type RenderOptions = { openMenuFor?: string };

/** Render into the host's overlay, outside the clipped table. */
export function renderRowActions(id: string): string {
  return `<div class="a-menu" role="menu" aria-label="Row actions">` +
    ROW_ACTIONS.map((x) => (`confirm` in x ? `<div role="separator"></div>` : ``) +
      `<button type="button" role="menuitem" ${attr(`data-id`, id)} ${attr(`data-act`, x.act)}` +
      (`confirm` in x ? ` class="a-danger"` : ``) + `>${x.label}</button>`).join(``) + `</div>`;
}

function actions(a: AutomationSummary, open: boolean): string {
  return `<div class="a-cell a-actions">` +
    `<button type="button" class="a-menu-trigger" data-act="menu" ${attr(`data-id`, a.id)} ` +
    `aria-label="More actions" aria-haspopup="menu" aria-expanded="${open}">` +
    `<span aria-hidden="true">⋯</span></button></div>`;
}

export function renderRow(a: AutomationSummary, options: RenderOptions = {}): string {
  const name = a.name || `Untitled`;
  const date = a.access === `limited` ? `—` : a.createdAtLabel ?? `—`;
  const tools = esc([...new Set(a.tools)].join(`, `));
  return `<div class="a-row" ${attr(`data-id`, a.id)}>` +
    `<button type="button" class="a-rowlink" data-act="edit" ${attr(`data-id`, a.id)} ` +
    `${attr(`aria-label`, `Edit ${name}`)}>` +
    `<span class="a-cell a-name">${esc(name)}</span>` +
    `<span class="a-cell a-author"><span class="a-author-meta">` +
    `<span class="a-author-name">${esc(a.createdBy || `-`)}</span>` +
    `<span class="a-date">${esc(date)}</span></span></span>` +
    `<span class="a-cell a-status"><span class="a-status-label">${a.enabled ? `Active` : `Inactive`}</span></span>` +
    `<span class="a-cell a-tools">${tools || `-`}</span></button>` +
    actions(a, options.openMenuFor === a.id) + `</div>`;
}

/** DL15–16: search-empty is only a label; ordinary empty includes creation. */
export function renderEmpty(searchActive: boolean): string {
  const content = searchActive ? `<div class="a-emptyh">No Results Found</div>` :
    `<div class="a-emptyh">No Automations Yet</div>` +
    `<div class="a-emptyp">${esc(DESCRIPTION)}</div>` +
    `<button type="button" class="a-empty-create" data-act="create">New Automation</button>`;
  return `<div class="a-empty">${content}</div>`;
}

function toolbar(q: ListQuery): string {
  return `<div class="a-bar"><div class="a-filters"><div class="a-tabs" role="tablist" aria-label="Automation filters">` +
    ([`mine`, `team`] as const).map((tab) =>
      `<button type="button" role="tab" data-act="tab" data-tab="${tab}" ` +
      `aria-selected="${(q.tab ?? `mine`) === tab}">${tab === `mine` ? `Mine` : `Team`}</button>`).join(``) +
    `</div></div><div class="a-toolbar-actions">` +
    `<button type="button" class="a-all-runs" data-act="allRuns">All Runs</button>` +
    `<div class="a-search-wrap"><div class="a-search-group"><input type="text" autocomplete="off" class="a-search" data-act="search" ` +
    `${attr(`value`, q.search ?? ``)} placeholder="Search..." aria-label="Search...">` +
    ((q.search ?? ``).trim() ? `<button type="button" data-act="clearSearch" aria-label="Clear search">×</button>` : ``) +
    `</div></div></div></div>`;
}

function table(items: readonly AutomationSummary[], options: RenderOptions): string {
  return `<div class="a-table"><div class="a-headrow">` +
    `<span class="a-cell a-name">Name</span><span class="a-cell a-author">Created By</span>` +
    `<span class="a-cell a-status">Status</span><span class="a-cell a-tools">Tools</span>` +
    `<span class="a-cell a-actions"></span></div>` +
    `<div class="a-rows">${items.map((a) => renderRow(a, options)).join(``)}</div></div>`;
}

function pagination(page: number, pages: number, total: number): string {
  if (pages <= 1) return ``;
  const first = (page - 1) * 25 + 1;
  const last = Math.min(page * 25, total);
  const number = (value: number): string => esc(value.toLocaleString());
  return `<div class="a-pagination"><span>${number(first)}–${number(last)} of ${number(total)}</span>` +
    `<div class="a-page-controls"><button type="button" class="a-page-arrow" data-act="page" data-page="${page - 1}" ` +
    `aria-label="Previous page"${page === 1 ? ` disabled` : ``}>‹</button>` +
    `<span>${number(page)} / ${number(pages)}</span>` +
    `<button type="button" class="a-page-arrow" data-act="page" data-page="${page + 1}" aria-label="Next page"` +
    `${page === pages ? ` disabled` : ``}>›</button></div></div>`;
}

export function renderList(items: readonly AutomationSummary[], q: ListQuery = {}, options: RenderOptions = {}): string {
  const result = listPage(items, q);
  const content = result.total === 0 ? renderEmpty((q.search ?? ``).trim() !== ``) :
    `<div class="a-list">${table(result.items, options)}${pagination(result.page, result.pages, result.total)}</div>`;
  return `<div class="a-page"><div class="a-chunks">` +
    `<header class="a-pagehead"><div class="a-title-row"><div class="a-title-group"><h1 class="a-h1">Automations</h1></div>` +
    `<div class="a-title-actions"><button class="a-create" type="button" data-act="create">New Automation</button></div></div>` +
    `<div class="a-content-row"><p class="a-description">${esc(DESCRIPTION)}</p></div></header>` +
    `<div class="a-body"><section class="a-toolbar-section" aria-label="Automations">${toolbar(q)}${content}</section></div>` +
    `</div></div>`;
}
