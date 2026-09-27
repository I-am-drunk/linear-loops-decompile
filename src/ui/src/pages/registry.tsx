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
import { LoopsListPage, LoopsStyles, demoLoops } from "../features/loops/index.ts";
import { navigate } from "../useHashRoute.ts";

// T-802: settings pages are live. Until R9's connect channel lands, they are
// wired to fixtures (intents are no-ops) — swap the containers, not the pages.
const noop = (): void => {};
const noopId = (_id: string): void => {};
const noopToggle = (_id: string, _enabled: boolean): void => {};
const noopInput = (..._args: unknown[]): void => {};

export interface PageDef {
  readonly title: string;
  readonly render: (route: Route) => JSX.Element;
}

export const PAGE_REGISTRY: Record<string, PageDef> = {
  // T-701 live: fixture container until R9's channel lands (container swap,
  // page untouched). Toggle is server-authoritative — intent is a no-op here,
  // so rows keep showing fixture state until a real container confirms.
  "loops": {
    title: "Loops",
    render: () => (
      <>
        <LoopsStyles />
        <LoopsListPage
          loops={demoLoops}
          inferenceConfigured={demoHarnesses.length > 0}
          onToggle={noopToggle}
          onOpen={(id) => navigate({ name: "loop-detail", loopId: id })}
          onNewLoop={() => navigate({ name: "loop-new" })}
          onOpenInferenceSettings={() => navigate({ name: "settings-inference" })}
        />
      </>
    ),
  },
  "loop-new": {
    title: "New loop",
    render: () => (
      <PlaceholderPage
        title="New loop"
        description="Template library + from-scratch flow."
        owner="T-702"
      />
    ),
  },
  "loop-detail": {
    title: "Loop",
    render: (route) => (
      <PlaceholderPage
        title="Loop detail"
        description="Editor: trigger, schedule, conditions, prompt, trusted sources."
        owner="T-702"
        note={route.name === "loop-detail" ? `loopId: ${route.loopId}` : undefined}
      />
    ),
  },
  "loop-runs": {
    title: "Runs",
    render: (route) => (
      <PlaceholderPage
        title="Runs"
        description="Run history with status, target, duration, cost."
        owner="T-703"
        note={route.name === "loop-runs" ? `loopId: ${route.loopId} ("all" = aggregate view)` : undefined}
      />
    ),
  },
  "run-detail": {
    title: "Run",
    render: (route) => (
      <PlaceholderPage
        title="Run detail"
        description="Live activity stream: thoughts, actions, responses; steer + cancel."
        owner="T-703"
        note={route.name === "run-detail" ? `runId: ${route.runId}` : undefined}
      />
    ),
  },
  "templates": {
    title: "Templates",
    render: () => (
      <PlaceholderPage
        title="Templates"
        description="Loop template library; using a template prefills a new draft."
        owner="T-702"
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
