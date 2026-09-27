/**
 * One loop row: icon tile, name, "trigger · owner" sub-line, last-run chip,
 * and the enabled switch. The switch is a separate control from row
 * navigation (stopPropagation) and is server-authoritative — it renders
 * `loop.enabled` from props and emits an intent; it never flips locally.
 */
import type { JSX } from "react";
import type { LoopSummary } from "./types.ts";
import { LoopGlyph } from "./LoopGlyph.tsx";
import { triggerLabel } from "./triggerLabel.ts";
import { lastRunLabel } from "./relativeTime.ts";
import { statusTone, NEVER_RUN_TONE } from "./statusTone.ts";

export interface LoopRowProps {
  readonly loop: LoopSummary;
  readonly now: Date;
  readonly onOpen: (id: string) => void;
  readonly onToggle: (id: string, enabled: boolean) => void;
}

export function LoopRow(props: LoopRowProps): JSX.Element {
  const { loop } = props;
  const open = (): void => props.onOpen(loop.id);
  const chip = loop.lastRun
    ? { label: lastRunLabel(loop.lastRun, props.now), tone: statusTone(loop.lastRun.status) }
    : { label: "Never run", tone: NEVER_RUN_TONE };
  return (
    <div
      className="ll-row"
      role="button"
      tabIndex={0}
      data-loop-id={loop.id}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
    >
      <LoopGlyph icon={loop.icon} color={loop.color} name={loop.name} />
      <span className="ll-row-main">
        <span className="ll-row-name">{loop.name}</span>
        <span className="ll-row-sub">
          {triggerLabel(loop.trigger)}
          {" · "}
          {loop.ownerName}
        </span>
      </span>
      <span className={`ll-chip ll-chip-${chip.tone}`}>{chip.label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={loop.enabled}
        aria-label={`${loop.enabled ? "Disable" : "Enable"} ${loop.name}`}
        className={`ll-switch${loop.enabled ? " on" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          props.onToggle(loop.id, !loop.enabled);
        }}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <span className="ll-switch-knob" />
      </button>
    </div>
  );
}
