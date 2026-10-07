/**
 * Rendering for the settings shell (ST1) and the five rows (ST2).
 *
 * Strings, not DOM. The mount sets innerHTML once per navigation, so every
 * interpolated value MUST be escaped — a workspace name, a model id or a
 * credential hint all come from outside and all land in markup.
 */

import type { ConnectionState, Page, Row, Section } from "./rows.ts";

/**
 * Escape for HTML text and double-quoted attributes.
 *
 * `&` first, or we would double-escape the entities we just inserted. The
 * quote cases matter because these values land in `value="..."` — a stray
 * quote there is an attribute injection, not a cosmetic bug.
 */
export function esc(s: string): string {
  return s
    .replace(/&/g, `&amp;`)
    .replace(/</g, `&lt;`)
    .replace(/>/g, `&gt;`)
    .replace(/"/g, `&quot;`)
    .replace(/'/g, `&#39;`);
}

const attr = (name: string, value: string): string => `${name}="${esc(value)}"`;

/** Masked presence, never a value. `configured` with no hint still reads. */
function credentialDisplay(configured: boolean, hint?: string): string {
  if (!configured) return `Not set`;
  return hint ? `Set · ${esc(hint)}` : `Set`;
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  connected: `Connected`,
  disconnected: `Not connected`,
  error: `Error`,
  checking: `Checking…`,
};

/** Row kinds whose control a `<label for>` can address natively. */
const NATIVE_LABEL = new Set([`select`, `text`, `toggle`]);

/** IDs remain valid for whitespace, quotes and arbitrary row identifiers. */
const idBase = (rowId: string, scope: string): string =>
  "settings-" + encodeURIComponent(JSON.stringify([scope, rowId]));
const ctlId = (rowId: string, scope: string): string => idBase(rowId, scope) + "-ctl";
const lblId = (rowId: string, scope: string): string => idBase(rowId, scope) + "-lbl";

/** The control half of a row. One case per pattern, no fallthrough. */
function control(row: Row, scope: string): string {
  const off = row.disabled ? ` disabled` : ``;
  switch (row.kind) {
    case `toggle`:
      return `<button type="button" class="s-toggle" role="switch" ${attr("id", ctlId(row.id, scope))} ${attr(
        `aria-checked`,
        String(row.on),
      )} ${attr(`aria-labelledby`, lblId(row.id, scope))} ${attr(`data-row`, row.id)}${off}><span class="s-knob"></span></button>`;
    case `select`:
      return `<select class="s-select" ${attr(`id`, ctlId(row.id, scope))} ${attr(`data-row`, row.id)}${off}>${row.options
        .map(
          (o) =>
            `<option ${attr(`value`, o.value)}${o.value === row.value ? ` selected` : ``}>${esc(o.label)}</option>`,
        )
        .join(``)}</select>`;
    case `text`:
      return `<input type="text" class="s-input" ${attr(`id`, ctlId(row.id, scope))} ${attr(`value`, row.value)} ${attr(
        `placeholder`,
        row.placeholder ?? ``,
      )} ${attr(`data-row`, row.id)}${off}>`;
    case `credential`:
      // No input element: a credential is never pre-filled, because a
      // pre-filled password field is a value travelling outward.
      return `<span class="s-cred">${credentialDisplay(row.configured, row.hint)}</span>` +
        `<button type="button" class="s-btn" ${attr(`aria-describedby`, lblId(row.id, scope))} ${attr(`data-row`, row.id)} ${attr(
          `data-act`,
          row.configured ? `replace` : `set`,
        )}${off}>${row.configured ? `Replace` : `Set`}</button>`;
    case `connection`:
      // `row.state` is a union member, not free text, so it is safe in a
      // class name without escaping — the type is the guarantee.
      return `<span class="s-badge s-${row.state}">${CONNECTION_LABEL[row.state]}</span>` +
        `${row.detail ? `<span class="s-detail">${esc(row.detail)}</span>` : ``}` +
        `<button type="button" class="s-btn" ${attr(`aria-describedby`, lblId(row.id, scope))} ${attr(`data-row`, row.id)} ${attr(
          `data-act`,
          row.state === `connected` ? `disconnect` : `connect`,
        )}${off}>${row.state === `connected` ? `Disconnect` : `Connect`}</button>`;
  }
}

/** Pass a distinct scope when composing standalone rows into one document. */
export function renderRow(row: Row, scope = "row"): string {
  const desc = row.description ? `<p class="s-rowdesc">${esc(row.description)}</p>` : ``;
  return (
    `<div class="s-row${row.disabled ? ` s-off` : ``}" ${attr(`data-id`, row.id)}>` +
    `<div class="s-rowtext"><label class="s-rowlabel" ${attr(`id`, lblId(row.id, scope))}${NATIVE_LABEL.has(row.kind) ? ` ${attr(`for`, ctlId(row.id, scope))}` : ``}>${esc(row.label)}</label>${desc}</div>` +
    `<div class="s-rowctl">${control(row, scope)}</div>` +
    `</div>`
  );
}

export function renderSection(section: Section, scope = "section"): string {
  const blurb = section.blurb ? `<p class="s-blurb">${esc(section.blurb)}</p>` : ``;
  return (
    `<section class="s-section" ${attr(`data-id`, section.id)}>` +
    `<h2 class="s-h2">${esc(section.title)}</h2>${blurb}` +
    `<div class="s-rows">${section.rows.map((row, index) => renderRow(row, `${scope}/row/${index}`)).join(``)}</div>` +
    `</section>`
  );
}

export type NavItem = { id: string; title: string };

/** Left nav. `current` gets aria-current, which is also the style hook. */
export function renderNav(items: readonly NavItem[], current: string): string {
  return (
    `<nav class="s-nav" aria-label="Settings">` +
    items
      .map(
        (i) =>
          `<a class="s-navitem" ${attr("data-page", i.id)} ${attr(`href`, `#/settings/${encodeURIComponent(i.id)}`)}${
            i.id === current ? ` aria-current="page"` : ``
          }>${esc(i.title)}</a>`,
      )
      .join(``) +
    `</nav>`
  );
}

export function renderPage(page: Page, scope = "page"): string {
  return (
    `<div class="s-page"><h1 class="s-h1">${esc(page.title)}</h1>` +
    page.sections.map((section, index) => renderSection(section, `${scope}/section/${index}`)).join(``) +
    `</div>`
  );
}

/** Shell: use distinct scopes when rendering multiple roots in one document. */
export function renderShell(items: readonly NavItem[], current: string, page: Page, scope = "shell"): string {
  return `<div class="s-shell">${renderNav(items, current)}<main class="s-main">${renderPage(page, scope)}</main></div>`;
}
