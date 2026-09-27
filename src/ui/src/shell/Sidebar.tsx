/**
 * Loops-only sidebar. Product bar: opening our app should feel like opening
 * Linear's Loops section — so the sidebar carries ONLY loop features
 * (Loops, Runs, Templates) plus Settings. No issues/projects/views: this is a
 * loops product, not a Linear tracker clone.
 */
import type { JSX } from "react";
import { navSectionOf } from "../router.ts";
import type { RouteName } from "../router.ts";
import { href } from "../useHashRoute.ts";
import { LoopIcon, PlusIcon, RunsIcon, SettingsIcon, TemplatesIcon } from "./icons.tsx";

export type EnvStatus = "connected" | "connecting" | "offline";

export interface SidebarProps {
  /** Current route name — drives the active item. */
  readonly active: RouteName;
  /** Workspace label shown in the header (from the connected Linear org). */
  readonly workspaceName: string;
  /** T3 connect status, shown as a dot beside Settings (wired by R9). */
  readonly envStatus: EnvStatus;
}

interface NavEntry {
  readonly section: "loops" | "settings";
  readonly label: string;
  readonly to: Parameters<typeof href>[0];
  readonly icon: JSX.Element;
  /** route names that should light this item up */
  readonly matches: (active: RouteName) => boolean;
}

const NAV: readonly NavEntry[] = [
  {
    section: "loops",
    label: "Loops",
    to: { name: "loops" },
    icon: <LoopIcon />,
    matches: (a) => navSectionOf(a) === "loops" && a !== "loop-runs" && a !== "run-detail" || a === "loops",
  },
  {
    section: "loops",
    label: "Runs",
    to: { name: "loop-runs", loopId: "all" },
    icon: <RunsIcon />,
    // Runs has no standalone route yet (T-703 will add /runs); until then the
    // item jumps to the aggregate runs view and lights up on run pages.
    matches: (a) => a === "loop-runs" || a === "run-detail",
  },
  {
    section: "loops",
    label: "Templates",
    to: { name: "templates" },
    icon: <TemplatesIcon />,
    matches: (a) => a === "templates",
  },
  {
    section: "settings",
    label: "Settings",
    to: { name: "settings" },
    icon: <SettingsIcon />,
    matches: (a) => navSectionOf(a) === "settings",
  },
];

const STATUS_LABEL: Record<EnvStatus, string> = {
  connected: "Environment connected",
  connecting: "Connecting…",
  offline: "Environment offline",
};

export function Sidebar(props: SidebarProps): JSX.Element {
  const loopItems = NAV.filter((n) => n.section === "loops");
  const settingsItems = NAV.filter((n) => n.section === "settings");
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar-head">
        <LoopIcon />
        <span>{props.workspaceName}</span>
      </div>
      <div className="sidebar-nav">
        <div className="sidebar-section">
          <div className="sidebar-section-title">
            <span>Loops</span>
            <a className="btn small" href={href({ name: "loop-new" })} aria-label="New loop">
              <PlusIcon /> New
            </a>
          </div>
          {loopItems.map((item) => (
            <a
              key={item.label}
              className="nav-item"
              href={href(item.to)}
              aria-current={item.matches(props.active) ? "page" : undefined}
            >
              {item.icon}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </div>
      <div className="sidebar-foot">
        {settingsItems.map((item) => (
          <a
            key={item.label}
            className="nav-item"
            href={href(item.to)}
            aria-current={item.matches(props.active) ? "page" : undefined}
          >
            {item.icon}
            <span>{item.label}</span>
            <span
              className={`status-dot ${props.envStatus === "connected" ? "ok" : props.envStatus}`}
              title={STATUS_LABEL[props.envStatus]}
              style={{ marginLeft: "auto" }}
            />
          </a>
        ))}
      </div>
    </nav>
  );
}

