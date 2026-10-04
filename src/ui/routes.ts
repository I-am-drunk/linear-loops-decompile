/**
 * The route table and the hash router.
 *
 * Hash routing deliberately: the server already serves a SPA fallback, and
 * hash routes work unchanged behind any mount path or tunnel, which matters
 * for a self-hosted app reached through Code Connect.
 *
 * Routes are DATA. The nav renders from this table and `SH1` owns it, so a
 * later lane adds a surface by adding a row — not by editing the shell.
 */
export interface RouteDef {
  /** Path after the `#`, no leading slash: `automations`, `settings/inference`. */
  path: string;
  title: string;
  /** Sidebar section, or `null` to stay out of the nav. */
  nav: "main" | "settings" | null;
  /** Lane that owns the surface; shown in the placeholder until it ships. */
  lane: string;
}

export const ROUTES: readonly RouteDef[] = [
  { path: "automations", title: "Automations", nav: "main", lane: "AU1" },
  { path: "automations/new", title: "New automation", nav: null, lane: "AU2" },
  { path: "runs", title: "Runs", nav: "main", lane: "AU6" },
  { path: "settings", title: "Settings", nav: "settings", lane: "ST1" },
  { path: "settings/inference", title: "Inference", nav: "settings", lane: "ST3" },
  { path: "settings/integrations", title: "Integrations", nav: "settings", lane: "ST4" },
  { path: "settings/mcp", title: "MCP servers", nav: "settings", lane: "ST5" },
  { path: "settings/workspace", title: "Workspace", nav: "settings", lane: "ST6" },
];

export const DEFAULT_PATH = "automations";

/** Normalize a location hash to a bare path. `#/x/` and `#x` both give `x`. */
export function pathFromHash(hash: string): string {
  const raw = hash.replace(/^#/, "").replace(/^\/+/, "").replace(/\/+$/, "");
  return raw === "" ? DEFAULT_PATH : raw;
}

/**
 * Longest-prefix match, so `automations/new` wins over `automations` while an
 * unknown child still resolves to its parent instead of 404-ing. Returns
 * `undefined` only when nothing matches at all.
 */
export function matchRoute(path: string): RouteDef | undefined {
  let best: RouteDef | undefined;
  for (const r of ROUTES) {
    if (r.path === path) return r;
    if (path.startsWith(`${r.path}/`) && (best === undefined || r.path.length > best.path.length)) {
      best = r;
    }
  }
  return best;
}

export function navRoutes(section: "main" | "settings"): RouteDef[] {
  return ROUTES.filter((r) => r.nav === section);
}
