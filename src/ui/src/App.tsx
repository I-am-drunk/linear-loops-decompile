/**
 * Root: route -> page registry -> shell. The workspace name + env status will
 * come from the T3 connect client (R9); until then they are fixtures.
 */
import type { JSX } from "react";
import { useHashRoute } from "./useHashRoute.ts";
import { AppShell } from "./shell/AppShell.tsx";
import { renderRoute } from "./pages/registry.tsx";

export interface AppProps {
  /** Overrides for tests and for the future connect-driven container. */
  readonly workspaceName?: string;
  readonly envStatus?: "connected" | "connecting" | "offline";
}

export function App(props: AppProps): JSX.Element {
  const route = useHashRoute();
  const { title, page } = renderRoute(route);
  return (
    <AppShell
      route={route}
      title={title}
      workspaceName={props.workspaceName ?? "Loops"}
      envStatus={props.envStatus ?? "offline"}
    >
      {page}
    </AppShell>
  );
}

