/**
 * The shell: sidebar + content frame, rendered from the route table.
 *
 * Pure DOM, zero dependencies. Every surface a later lane builds mounts into
 * the content slot; nothing here knows what a surface contains.
 */
import { ROUTES, DEFAULT_PATH, matchRoute, navRoutes, pathFromHash, type RouteDef } from "./routes.ts";

export interface ShellHost {
  document: Document;
  location: { hash: string };
}

/** What a lane registers to own a route. */
export type SurfaceRenderer = (slot: HTMLElement, route: RouteDef) => void;

const registry = new Map<string, SurfaceRenderer>();

/** Lanes call this to claim a route; last registration wins. */
export function registerSurface(path: string, render: SurfaceRenderer): void {
  registry.set(path, render);
}

/** The placeholder every unclaimed route shows: honest about being unbuilt. */
function renderPlaceholder(slot: HTMLElement, route: RouteDef): void {
  const doc = slot.ownerDocument;
  const wrap = doc.createElement("div");
  wrap.className = "placeholder";
  const h = doc.createElement("h1");
  h.textContent = route.title;
  const p = doc.createElement("p");
  p.textContent = `Not built yet — slice ${route.lane}.`;
  wrap.append(h, p);
  slot.replaceChildren(wrap);
}

function navLink(doc: Document, route: RouteDef, current: string): HTMLElement {
  const a = doc.createElement("a");
  a.className = "nav-item";
  a.href = `#${route.path}`;
  a.textContent = route.title;
  if (route.path === current) a.setAttribute("aria-current", "page");
  return a;
}

function renderNav(doc: Document, current: string): HTMLElement {
  const aside = doc.createElement("aside");
  aside.className = "sidebar";

  const brand = doc.createElement("div");
  brand.className = "brand";
  brand.textContent = "Automations";
  aside.append(brand);

  for (const section of ["main", "settings"] as const) {
    const routes = navRoutes(section);
    if (routes.length === 0) continue;
    const group = doc.createElement("nav");
    group.className = "nav-group";
    if (section === "settings") {
      const label = doc.createElement("div");
      label.className = "nav-label";
      label.textContent = "Settings";
      group.append(label);
    }
    // The Settings root links the section; its children are the rows under it.
    for (const r of routes) {
      if (section === "settings" && r.path === "settings") continue;
      group.append(navLink(doc, r, current));
    }
    aside.append(group);
  }
  return aside;
}

/** Render the whole shell for the host's current hash. Idempotent. */
export function render(host: ShellHost): void {
  const doc = host.document;
  const root = doc.getElementById("root");
  if (!root) throw new Error("shell: #root is missing");

  const path = pathFromHash(host.location.hash);
  const route = matchRoute(path) ?? matchRoute(DEFAULT_PATH)!;

  const layout = doc.createElement("div");
  layout.className = "layout";

  const main = doc.createElement("main");
  main.className = "content";
  const slot = doc.createElement("div");
  slot.className = "content-slot";
  main.append(slot);

  layout.append(renderNav(doc, route.path), main);
  root.replaceChildren(layout);

  (registry.get(route.path) ?? renderPlaceholder)(slot, route);
  doc.title = `${route.title} · Automations`;
}

/** Wire the router. Returns a teardown for tests. */
export function start(host: ShellHost & { addEventListener?: typeof window.addEventListener }): () => void {
  const onChange = () => render(host);
  render(host);
  const target = host as unknown as Window;
  target.addEventListener?.("hashchange", onChange);
  return () => target.removeEventListener?.("hashchange", onChange);
}

export { ROUTES };
