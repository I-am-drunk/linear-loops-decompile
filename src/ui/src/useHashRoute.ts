/**
 * React binding for the hash router. `useHashRoute` subscribes to hashchange;
 * `navigate` sets location.hash (pushState-free: hash IS the history entry).
 */
import { useCallback, useSyncExternalStore } from "react";
import { parseHash, routeToHash } from "./router.ts";
import type { Route } from "./router.ts";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function getSnapshot(): string {
  // Also the SSR/test fallback: if a window exists (real browser or test stub),
  // trust it; otherwise default to the loops list.
  return typeof window === "undefined" ? "#/loops" : window.location.hash;
}

export function useHashRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return parseHash(hash);
}

export function navigate(route: Exclude<Route, { name: "not-found" }>): void {
  window.location.hash = routeToHash(route);
}

/** For anchors: build hrefs with this so tests/storybook stay router-agnostic. */
export function href(route: Exclude<Route, { name: "not-found" }>): string {
  return routeToHash(route);
}

export const useNavigate = (): ((route: Exclude<Route, { name: "not-found" }>) => void) =>
  useCallback((route) => navigate(route), []);

