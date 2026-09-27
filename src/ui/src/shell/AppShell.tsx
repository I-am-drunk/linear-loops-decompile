/**
 * App frame: sidebar + topbar (title + breadcrumbs) + scrollable content.
 * Presentational only — it never fetches; pages and the R9 transport plug in
 * through props and the page registry (see src/pages/registry.tsx).
 */
import type { JSX, ReactNode } from "react";
import type { Route } from "../router.ts";
import { Sidebar } from "./Sidebar.tsx";
import type { EnvStatus } from "./Sidebar.tsx";

export interface AppShellProps {
  readonly route: Route;
  readonly workspaceName: string;
  readonly envStatus: EnvStatus;
  /** Page title shown in the topbar (e.g. "Loops", a loop's name, "Settings"). */
  readonly title: string;
  /** Optional breadcrumb trail after the title, e.g. ["My loop", "Runs"]. */
  readonly crumbs?: readonly string[];
  readonly children: ReactNode;
}

export function AppShell(props: AppShellProps): JSX.Element {
  return (
    <div className="shell">
      <Sidebar active={props.route.name} workspaceName={props.workspaceName} envStatus={props.envStatus} />
      <div className="main">
        <header className="topbar">
          <span className="topbar-title">{props.title}</span>
          {props.crumbs?.map((c, i) => (
            <span key={i} className="topbar-crumbs">
              {" "}/ {c}
            </span>
          ))}
        </header>
        <main className="content">{props.children}</main>
      </div>
    </div>
  );
}

