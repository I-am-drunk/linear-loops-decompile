/**
 * Hash router core — pure functions, no React, no DOM. Unit-testable under
 * `node --experimental-strip-types --test` (keep this file free of enums,
 * namespaces, and parameter properties so type stripping works).
 *
 * The app is self-hosted and single-workspace, so routes carry no org prefix
 * (Linear's own loop routes are `/:org/loop/:id/...`; ours drop the `:org`).
 */
export type Route =
  | { name: "loops" }
  | { name: "loop-new" }
  | { name: "loop-detail"; loopId: string }
  | { name: "loop-runs"; loopId: string }
  | { name: "run-detail"; loopId: string; runId: string }
  | { name: "templates" }
  | { name: "settings" }
  | { name: "settings-linear" }
  | { name: "settings-inference" }
  | { name: "settings-environment" }
  | { name: "not-found"; path: string };

export type RouteName = Route["name"];

type Segment = string;

interface Pattern {
  readonly route: (params: Readonly<Record<string, string>>) => Route;
  readonly segments: readonly Segment[];
}

function compile(path: string, route: (params: Readonly<Record<string, string>>) => Route): Pattern {
  return { route, segments: path.split("/").filter((s) => s.length > 0) };
}

/** Order matters: first match wins, so list specific paths above parameterized ones. */
const PATTERNS: readonly Pattern[] = [
  compile("/loops", () => ({ name: "loops" })),
  compile("/loops/new", () => ({ name: "loop-new" })),
  compile("/loop/:loopId", (p) => ({ name: "loop-detail", loopId: p["loopId"] ?? "" })),
  compile("/loop/:loopId/runs", (p) => ({ name: "loop-runs", loopId: p["loopId"] ?? "" })),
  compile("/loop/:loopId/run/:runId", (p) => ({
    name: "run-detail",
    loopId: p["loopId"] ?? "",
    runId: p["runId"] ?? "",
  })),
  compile("/templates", () => ({ name: "templates" })),
  compile("/settings", () => ({ name: "settings" })),
  compile("/settings/linear", () => ({ name: "settings-linear" })),
  compile("/settings/inference", () => ({ name: "settings-inference" })),
  compile("/settings/environment", () => ({ name: "settings-environment" })),
];

function matchPath(pattern: Pattern, segments: readonly string[]): Route | null {
  if (pattern.segments.length !== segments.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.segments.length; i++) {
    const want = pattern.segments[i]!;
    const got = segments[i]!;
    if (want.startsWith(":")) {
      const decoded = decodeURIComponent(got);
      if (decoded.length === 0) return null;
      params[want.slice(1)] = decoded;
    } else if (want !== got) {
      return null;
    }
  }
  return pattern.route(params);
}

/** Normalize a raw `location.hash` value to a path: "#/loop/1" -> "/loop/1". */
export function normalizeHash(hash: string): string {
  let h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h.startsWith("/")) h = "/" + h;
  // strip trailing slashes (but keep the root "/")
  while (h.length > 1 && h.endsWith("/")) h = h.slice(0, -1);
  return h;
}

/** Parse a hash (or path) into a Route. "" / "#/" / "/" resolve to the loops list. */
export function parseHash(hash: string): Route {
  const path = normalizeHash(hash);
  if (path === "/") return { name: "loops" };
  const segments = path.split("/").filter((s) => s.length > 0);
  for (const pattern of PATTERNS) {
    const r = matchPath(pattern, segments);
    if (r) return r;
  }
  return { name: "not-found", path };
}

/** Inverse of parseHash (every route except not-found round-trips). */
export function routeToPath(route: Exclude<Route, { name: "not-found" }>): string {
  switch (route.name) {
    case "loops":
      return "/loops";
    case "loop-new":
      return "/loops/new";
    case "loop-detail":
      return `/loop/${encodeURIComponent(route.loopId)}`;
    case "loop-runs":
      return `/loop/${encodeURIComponent(route.loopId)}/runs`;
    case "run-detail":
      return `/loop/${encodeURIComponent(route.loopId)}/run/${encodeURIComponent(route.runId)}`;
    case "templates":
      return "/templates";
    case "settings":
      return "/settings";
    case "settings-linear":
      return "/settings/linear";
    case "settings-inference":
      return "/settings/inference";
    case "settings-environment":
      return "/settings/environment";
  }
}

export function routeToHash(route: Exclude<Route, { name: "not-found" }>): string {
  return "#" + routeToPath(route);
}

/** The settings family shares one nav item; used by the sidebar's active state. */
export function isSettingsRoute(name: RouteName): boolean {
  return name === "settings" || name === "settings-linear" || name === "settings-inference" || name === "settings-environment";
}

/** Which top-level nav section a route belongs to (drives sidebar highlighting). */
export function navSectionOf(name: RouteName): "loops" | "templates" | "settings" | "none" {
  if (name === "loops" || name === "loop-new" || name === "loop-detail" || name === "loop-runs" || name === "run-detail") return "loops";
  if (name === "templates") return "templates";
  if (isSettingsRoute(name)) return "settings";
  return "none";
}

