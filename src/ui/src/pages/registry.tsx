/**
 * Page registry — registry-as-data (house convention). Maps each route to its
 * page component and topbar title. Feature owners (R7 loops pages, T-802
 * settings pages) replace the placeholder entries here; the shell never changes.
 *
 * Contracts:
 *  - Pages receive their parsed route as the `route` prop.
 *  - Pages never talk to the network directly; they take data/callbacks via
 *    props from a container that speaks T3 connect (R9) — until then, fixtures.
 */
import type { JSX } from "react";
import type { Route } from "../router.ts";
import { NotFoundPage, PlaceholderPage } from "./Placeholders.tsx";
import {
  ConnectInferencePage,
  ConnectLinearPage,
  EnvironmentPage,
  SettingsHomePage,
  SettingsStyles,
} from "../features/settings/index.ts";
import {
  demoEnvironment,
  demoHarnesses,
  demoLinearDisconnected,
  demoSessions,
} from "../features/settings/fixtures.ts";
import { LoopsStyles } from "../features/loops/index.ts";
import { RunsStyles } from "../features/loops/runs/index.ts";
import {
  EditorContainer,
  LoopsListContainer,
  RunsListContainer,
  RunDetailContainer,
} from "../live/index.ts";
import { navigate } from "../useHashRoute.ts";

// T-802: settings pages are live. Until R9's connect channel lands, they are
// wired to fixtures (intents are no-ops) — swap the containers, not the pages.
const noop = (): void => {};
const noopId = (_id: string): void => {};
const noopInput = (..._args: unknown[]): void => {};

export interface PageDef {
  readonly title: string;
  readonly render: (route: Route) => JSX.Element;
}

export const PAGE_REGISTRY: Record<string, PageDef> = {
  // T-701 + T-1104: live over T3 connect when a token is configured, fixtures
  // otherwise (container decides; page untouched). Toggle server-authoritative.
  "loops": {
    title: "Loops",
    render: () => (
      <>
        <LoopsStyles />
        <LoopsListContainer />
      </>
    ),
  },
  // T-805: loop-new is live — the T-702 editor behind the connect-backed
  // EditorContainer (fixture demo offline; saveLoop publishes over the wire).
  "loop-new": {
    title: "New loop",
    // key forces a remount on route change: AppShell renders children unkeyed,
    // and two editor routes at one position would otherwise share state.
    render: () => <EditorContainer key="loop-new" loopId={null} />,
  },
  // T-805: loop-detail loads the loop through the same container
  // (loops.get); per-id remount via the namespaced key.
  "loop-detail": {
    title: "Loop",
    render: (route) => (
      <EditorContainer
        key={route.name === "loop-detail" ? `loop-detail:${route.loopId}` : "loop-detail"}
        loopId={route.name === "loop-detail" ? route.loopId : ""}
      />
    ),
  },
  // T-703 + T-1104: runs pages live over the channel (fixture fallback).
  "loop-runs": {
    title: "Runs",
    render: (route) => (
      <>
        <RunsStyles />
        <RunsListContainer loopId={route.name === "loop-runs" ? route.loopId : "all"} />
      </>
    ),
  },
  "run-detail": {
    title: "Run",
    render: (route) => (
      <>
        <RunsStyles />
        {route.name === "run-detail" ? (
          <RunDetailContainer loopId={route.loopId} runId={route.runId} />
        ) : (
          <PlaceholderPage title="Run" description="Missing run id." owner="T-703" />
        )}
      </>
    ),
  },
  "templates": {
    title: "Templates",
    render: () => (
      <PlaceholderPage
        title="Templates"
        description="Loop template library; using a template prefills a new draft."
        owner="T-704"
      />
    ),
  },
  "settings": {
    title: "Settings",
    render: () => (
      <>
        <SettingsStyles />
        <SettingsHomePage
          linear={demoLinearDisconnected}
          harnesses={demoHarnesses}
          environment={demoEnvironment}
        />
      </>
    ),
  },
  "settings-linear": {
    title: "Connect Linear",
    render: () => (
      <>
        <SettingsStyles />
        <ConnectLinearPage
          connection={demoLinearDisconnected}
          onVerify={noopInput}
          onDisconnect={noop}
        />
      </>
    ),
  },
  "settings-inference": {
    title: "Connect inference",
    render: () => (
      <>
        <SettingsStyles />
        <ConnectInferencePage
          harnesses={demoHarnesses}
          probe={{ kind: "idle" }}
          test={{ kind: "idle" }}
          onSave={noopInput}
          onDelete={noopId}
          onSetDefault={noopId}
          onProbeModels={noopInput}
          onTest={noopId}
        />
      </>
    ),
  },
  "settings-environment": {
    title: "Environment",
    render: () => (
      <>
        <SettingsStyles />
        <EnvironmentPage
          environment={demoEnvironment}
          sessions={demoSessions}
          onPair={noop}
          onRevoke={noopId}
        />
      </>
    ),
  },
};

export function renderRoute(route: Route): { title: string; page: JSX.Element } {
  if (route.name === "not-found") {
    return { title: "Not found", page: <NotFoundPage path={route.path} /> };
  }
  const def = PAGE_REGISTRY[route.name];
  if (!def) return { title: "Not found", page: <NotFoundPage path={route.name} /> };
  return { title: def.title, page: def.render(route) };
}
