/**
 * T-703 — runs list: newest-first rows with status dot, target chip,
 * duration + cost, and the All/Active/Failed filter. Rows open the run
 * detail. Filter state is local (client-side over props, like the list).
 */
import { useState } from "react";
import type { JSX } from "react";
import type { RunSummary, RunsListPageProps } from "./types.ts";
import { RUNS_FILTERS, filterRuns } from "./runsFilter.ts";
import type { RunsFilter } from "./runsFilter.ts";
import { formatCost, formatDuration, isLiveStatus, statusLabel } from "./format.ts";
import { statusTone } from "../statusTone.ts";
import { relativeAgo } from "../relativeTime.ts";

const FILTER_LABELS: Record<RunsFilter, string> = {
  all: "All",
  active: "Active",
  failed: "Failed",
};

function RunRow(props: { readonly run: RunSummary; readonly onOpen: () => void }): JSX.Element {
  const { run } = props;
  const now = new Date();
  return (
    <div
      className="lr-row"
      role="button"
      tabIndex={0}
      onClick={props.onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          props.onOpen();
        }
      }}
    >
      <span className={`lr-dot lr-dot-${statusTone(run.status)}${isLiveStatus(run.status) ? " live" : ""}`} />
      <span className="lr-row-main">
        <span className="lr-row-title">
          {run.loopName}
          {run.target ? <span className="lr-target">{run.target.label}</span> : null}
        </span>
        <span className="lr-row-sub">
          {statusLabel(run.status)}
          {" · "}
          {relativeAgo(run.createdAt, now)}
          {run.durationMs !== undefined ? ` · ${formatDuration(run.durationMs)}` : ""}
          {run.costUsd !== undefined ? ` · ${formatCost(run.costUsd)}` : ""}
        </span>
      </span>
    </div>
  );
}

export function RunsListPage(props: RunsListPageProps): JSX.Element {
  const [filter, setFilter] = useState<RunsFilter>("all");
  const visible = filterRuns(props.runs, filter);
  return (
    <div className="lr-page">
      <div className="le-segment" role="radiogroup" aria-label="Filter runs">
        {RUNS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            role="radio"
            aria-checked={filter === f}
            className={`le-segment-btn${filter === f ? " on" : ""}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="ll-empty" data-testid="runs-empty">
          <h1>No runs</h1>
          <p>{filter === "all" ? "This loop hasn't run yet." : `No ${FILTER_LABELS[filter].toLowerCase()} runs.`}</p>
        </div>
      ) : (
        <div className="lr-list">
          {visible.map((run) => (
            <RunRow key={run.id} run={run} onOpen={() => props.onOpenRun(run.loopId, run.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
