/**
 * Automations list rendering (AU1).
 *
 * Same contract as src/ui-settings: data in, HTML string out, every
 * interpolated value escaped. Automation names, model ids, tool names and
 * creator names are all user- or integration-supplied and all land in markup.
 */

import { esc } from "../ui-settings/render.ts";
import type { AutomationSummary, ListQuery, RunStatus } from "./model.ts";
import { listFor } from "./model.ts";

const attr = (name: string, value: string): string => `${name}="${esc(value)}"`;

const STATUS_LABEL: Record<RunStatus, string> = {
  queued: `Queued`,
  running: `Running`,
  succeeded: `Succeeded`,
  failed: `Failed`,
  cancelled: `Cancelled`,
};

/** Row actions, per docs/plan/automations.md. Delete confirms. */
export const ROW_ACTIONS = [
  { act: `edit`, label: `Edit` },
  { act: `duplicate`, label: `Duplicate` },
  { act: `copyJson`, label: `Copy as JSON` },
  { act: `delete`, label: `Delete`, confirm: true },
] as const;

function tools(names: readonly string[]): string {
  if (names.length === 0) return `<span class="a-dim">No tools</span>`;
  // Two chips plus a count: a long tool list would otherwise set the row
  // height and push the actions off the end.
  const shown = names.slice(0, 2).map((t) => `<span class="a-chip">${esc(t)}</span>`).join(``);
  const rest = names.length - 2;
  return shown + (rest > 0 ? `<span class="a-chip a-more">+${rest}</span>` : ``);
}

function lastRun(a: AutomationSummary): string {
  if (!a.lastRun) return `<span class="a-dim">Never run</span>`;
  const { status, at } = a.lastRun;
  return `<span class="a-badge a-${status}">${STATUS_LABEL[status]}</span>` +
    `<span class="a-dim">${esc(at)}</span>`;
}

export function renderRow(a: AutomationSummary): string {
  return (
    `<div class="a-row${a.enabled ? `` : ` a-disabled`}" ${attr(`data-id`, a.id)}>` +
    `<div class="a-main">` +
    `<a class="a-name" ${attr(`href`, `#/automations/${a.id}`)}>${esc(a.name)}</a>` +
    `<div class="a-meta">${esc(a.model)} · ${esc(a.createdBy)} · ` +
    `${a.triggerCount} ${a.triggerCount === 1 ? `trigger` : `triggers`}</div>` +
    `</div>` +
    `<div class="a-tools">${tools(a.tools)}</div>` +
    `<div class="a-run">${lastRun(a)}</div>` +
    `<div class="a-state">${a.enabled ? `Enabled` : `Disabled`}</div>` +
    `<div class="a-actions">` +
    ROW_ACTIONS.map(
      (x) =>
        `<button type="button" class="a-act${`confirm` in x ? ` a-danger` : ``}" ` +
        `${attr(`data-id`, a.id)} ${attr(`data-act`, x.act)}>${x.label}</button>`,
    ).join(``) +
    `</div>` +
    `</div>`
  );
}

/**
 * Two different empty states, because they are different problems.
 *
 * No automations at all is an onboarding moment: title, description, one
 * button. A query that matched nothing is a dead end the user can back out
 * of, so it offers "Clear filters" and must NOT offer "New automation" —
 * suggesting creation when ten automations exist behind a filter is wrong.
 */
export function renderEmpty(filtered: boolean): string {
  if (filtered) {
    return (
      `<div class="a-empty"><h2 class="a-emptyh">No matches</h2>` +
      `<p class="a-emptyp">No automation matches this search or filter.</p>` +
      `<button type="button" class="a-primary" data-act="clearFilters">Clear filters</button></div>`
    );
  }
  return (
    `<div class="a-empty"><h2 class="a-emptyh">No automations yet</h2>` +
    `<p class="a-emptyp">An automation runs a prompt when something happens — on a schedule, ` +
    `on an event from a connected service, or when you press run.</p>` +
    `<button type="button" class="a-primary" data-act="create">New automation</button></div>`
  );
}

function toolbar(q: ListQuery, allTools: readonly string[]): string {
  const opt = (v: string, label: string, sel: boolean): string =>
    `<option ${attr(`value`, v)}${sel ? ` selected` : ``}>${esc(label)}</option>`;
  const state = q.enabled === undefined ? `all` : q.enabled ? `on` : `off`;
  return (
    `<div class="a-bar">` +
    `<input type="search" class="a-search" data-act="search" ` +
    `${attr(`value`, q.search ?? ``)} placeholder="Search automations">` +
    `<select class="a-filter" data-act="filterEnabled">` +
    opt(`all`, `All`, state === `all`) + opt(`on`, `Enabled`, state === `on`) +
    opt(`off`, `Disabled`, state === `off`) +
    `</select>` +
    `<select class="a-filter" data-act="filterTool">` +
    opt(``, `Any tool`, q.tool === undefined) +
    allTools.map((t) => opt(t, t, q.tool === t)).join(``) +
    `</select>` +
    `<button type="button" class="a-primary" data-act="create">New automation</button>` +
    `</div>`
  );
}

/** Every tool name present, sorted, for the filter dropdown. */
export const toolsOf = (items: readonly AutomationSummary[]): string[] =>
  [...new Set(items.flatMap((a) => a.tools))].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));

export function renderList(items: readonly AutomationSummary[], q: ListQuery = {}): string {
  const shown = listFor(items, q);
  const body = shown.length === 0
    // `filtered` keys off the UNFILTERED set, so a query that hides every row
    // still gets the dead-end state rather than the onboarding one.
    ? renderEmpty(items.length > 0)
    : `<div class="a-rows">${shown.map(renderRow).join(``)}</div>`;
  return (
    `<div class="a-page"><h1 class="a-h1">Automations</h1>` +
    toolbar(q, toolsOf(items)) + body + `</div>`
  );
}
