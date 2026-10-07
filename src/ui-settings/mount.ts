/**
 * Mount (ST1): put a settings page in an element and report interactions.
 *
 * Event delegation on one listener per event type, keyed on `data-row`, rather
 * than a listener per control: re-rendering replaces the markup, and
 * per-control listeners would leak on every navigation.
 *
 * Deliberately dumb. It emits what the user did and re-renders what it is
 * told; it owns no persisted state and performs no RPC. Persistence is a later slice,
 * so this one can be reviewed and tested on its own.
 */

import { renderShell, type NavItem } from "./render.ts";
import type { Page } from "./rows.ts";

/** What the user did. One shape, so a host switches on `kind`. */
export type SettingsEvent =
  | { kind: "navigate"; page: string }
  | { kind: `toggle`; row: string; on: boolean }
  | { kind: `select`; row: string; value: string }
  | { kind: `text`; row: string; value: string }
  | { kind: `action`; row: string; act: string };

export type MountOptions = {
  items: readonly NavItem[];
  current: string;
  page: Page;
  /** Navigation requests a page; the host supplies it through update(). */
  onEvent?: (event: SettingsEvent) => void;
};

/**
 * The DOM surface we need, named structurally.
 *
 * Typing against these instead of `lib.dom` keeps the package testable under
 * plain Node with a tiny fake, and keeps `tsconfig` free of a DOM lib the
 * rest of the repo does not use.
 */
export type Elementish = {
  innerHTML: string;
  addEventListener(type: string, handler: (event: EventLike) => void): void;
  removeEventListener(type: string, handler: (event: EventLike) => void): void;
  querySelector(selectors: string): AttrNode | null;
};

export type AttrNode = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  closest(selectors: string): AttrNode | null;
  tagName?: string;
  value?: string;
};

export type EventLike = {
  type: string;
  target: AttrNode | null;
  button?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  defaultPrevented?: boolean;
  preventDefault?(): void;
};

/** Nearest ancestor (or self) carrying `data-row`. */
function rowOf(node: AttrNode | null): AttrNode | null {
  if (!node || typeof node.getAttribute !== "function") return null;
  return node.getAttribute(`data-row`) !== null ? node : node.closest(`[data-row]`);
}

function toEvent(node: AttrNode): SettingsEvent | undefined {
  if (node.getAttribute("disabled") !== null) return undefined;
  const row = node.getAttribute(`data-row`);
  if (row === null) return undefined;

  const act = node.getAttribute(`data-act`);
  if (act !== null) return { kind: `action`, row, act };

  const checked = node.getAttribute(`aria-checked`);
  // Report the state being requested, not the one on screen.
  if (checked !== null) return { kind: `toggle`, row, on: checked !== `true` };

  const tag = (node.tagName ?? ``).toLowerCase();
  if (tag === `select`) return { kind: `select`, row, value: node.value ?? `` };
  if (tag === `input`) return { kind: `text`, row, value: node.value ?? `` };
  return undefined;
}

export type Mounted = {
  /** Re-render with a new page and/or selected nav item. */
  update(next: { current?: string; page?: Page }): void;
  /** Release listeners and make later updates inert. Safe to call twice. */
  dispose(): void;
};

const activeMounts = new WeakMap<Elementish, Mounted>();
let nextMountId = 0;

export function mountSettings(host: Elementish, opts: MountOptions): Mounted {
  const namespace = `settings-${nextMountId++}`;
  let disposed = false;
  let current = opts.current;
  let page = opts.page;

  // Render first: a failed replacement must preserve the active mount.
  const initialMarkup = renderShell(opts.items, current, page, namespace);

  const handle = (event: EventLike): void => {
    if (disposed || event.defaultPrevented) return;
    const target = event.target;
    const nav = target && typeof target.getAttribute === "function"
      ? (target.getAttribute("data-page") !== null ? target : target.closest("[data-page]")) : null;
    if (event.type === "click" && nav) {
      const id = nav.getAttribute("data-page");
      const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      if (id !== null && !modified && (event.button ?? 0) === 0 && opts.onEvent
        && opts.items.some((item) => item.id === id)) {
        event.preventDefault?.();
        opts.onEvent({ kind: "navigate", page: id });
      }
      return;
    }
    const node = rowOf(event.target);
    if (!node) return;
    // `change` carries select/input; `click` carries toggle/button. Reading
    // both from one handler would double-report a toggle.
    // These are EVENT kinds, not tag names. `text` rows render an <input>,
    // so writing `input` here silently dropped every text edit.
    const wanted: SettingsEvent[`kind`][] =
      event.type === `change` ? [`select`, `text`] : [`toggle`, `action`];
    const translated = toEvent(node);
    if (translated && wanted.includes(translated.kind)) opts.onEvent?.(translated);
  };

  const mounted: Mounted = {
    update(next): void {
      if (disposed) return;
      const nextCurrent = next.current ?? current;
      const nextPage = next.page ?? page;
      host.innerHTML = renderShell(opts.items, nextCurrent, nextPage, namespace);
      current = nextCurrent;
      page = nextPage;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      host.removeEventListener("click", handle);
      host.removeEventListener("change", handle);
      if (activeMounts.get(host) === mounted) activeMounts.delete(host);
    },
  };
  host.innerHTML = initialMarkup;
  activeMounts.get(host)?.dispose();
  host.addEventListener(`click`, handle);
  host.addEventListener(`change`, handle);
  activeMounts.set(host, mounted);
  return mounted;
}
