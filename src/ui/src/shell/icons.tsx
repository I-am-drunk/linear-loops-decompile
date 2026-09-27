/**
 * Minimal inline SVG icons (original, hand-drawn 16x16 strokes). No icon dep.
 * Stroke-based, currentColor, so they inherit nav-item text color.
 */
import type { JSX } from "react";

function base(children: JSX.Element | JSX.Element[]): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const LoopIcon = (): JSX.Element =>
  base([
    <path key="a" d="M13.5 8a5.5 5.5 0 1 1-1.61-3.89" />,
    <path key="b" d="M13.5 2.5v3h-3" />,
  ]);

export const RunsIcon = (): JSX.Element =>
  base([
    <path key="a" d="M3 4.5h10" />,
    <path key="b" d="M3 8h10" />,
    <path key="c" d="M3 11.5h6" />,
  ]);

export const TemplatesIcon = (): JSX.Element =>
  base([
    <rect key="a" x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />,
    <rect key="b" x="9" y="2.5" width="4.5" height="4.5" rx="1" />,
    <rect key="c" x="2.5" y="9" width="4.5" height="4.5" rx="1" />,
    <rect key="d" x="9" y="9" width="4.5" height="4.5" rx="1" />,
  ]);

export const SettingsIcon = (): JSX.Element =>
  base([
    <circle key="a" cx="8" cy="8" r="2.25" />,
    <path key="b" d="M8 1.75v1.5M8 12.75v1.5M14.25 8h-1.5M3.25 8h-1.5M12.42 3.58l-1.06 1.06M4.64 11.36l-1.06 1.06M12.42 12.42l-1.06-1.06M4.64 4.64L3.58 3.58" />,
  ]);

export const PlusIcon = (): JSX.Element =>
  base([<path key="a" d="M8 3.5v9M3.5 8h9" />]);

