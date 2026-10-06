/**
 * The shell's routes.
 *
 * One route per lane surface. Paths and labels are OURS -- this is our
 * product's information architecture, not a reproduction of Linear's nav, so
 * they need no corpus citation. The DIMENSIONS the nav renders at do, and
 * live in ui-facts.json.
 *
 * Per owner decision 10, the automations page is the centrepiece and Linear
 * is one integration among others, so Automations sorts above Integrations.
 */
export interface Route {
  readonly path: string;
  readonly label: string;
  readonly section: string;
}

export const ROUTES: readonly Route[] = [
  { path: "/automations", label: "Automations", section: "Workspace" },
  { path: "/runs", label: "Runs", section: "Workspace" },
  { path: "/settings/inference", label: "Inference", section: "Settings" },
  { path: "/settings/integrations", label: "Integrations", section: "Settings" },
  { path: "/settings/mcp", label: "MCP servers", section: "Settings" },
];

export const DEFAULT_PATH = "/automations";

/** Section names in first-appearance order — no separate list to drift. */
export function sections(routes: readonly Route[] = ROUTES): string[] {
  const seen: string[] = [];
  for (const r of routes) if (!seen.includes(r.section)) seen.push(r.section);
  return seen;
}

/** The routes under one section, in declaration order. */
export function routesIn(
  section: string,
  routes: readonly Route[] = ROUTES,
): Route[] {
  return routes.filter((r) => r.section === section);
}

/**
 * The route a location resolves to, or null.
 *
 * Longest-prefix match, so `/settings/inference/advanced` still highlights
 * Inference rather than falling back to the default. An exact-only match
 * would silently unhighlight the nav on any sub-path.
 */
export function matchRoute(
  pathname: string,
  routes: readonly Route[] = ROUTES,
): Route | null {
  let best: Route | null = null;
  for (const r of routes) {
    const isPrefix = pathname === r.path || pathname.startsWith(`${r.path}/`);
    if (isPrefix && (!best || r.path.length > best.path.length)) best = r;
  }
  return best;
}
