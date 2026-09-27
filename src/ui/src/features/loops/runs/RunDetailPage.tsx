/**
 * T-703 — run detail: status header (live pulse), usage line, summary,
 * ordered activity stream, cancel while live, and the follow-up box.
 * Presentational; cancel/steer/answer/continue are intents on props.
 */
import type { JSX } from "react";
import type { RunDetailPageProps } from "./types.ts";
import { ActivityStream } from "./ActivityStream.tsx";
import { FollowUpBox } from "./FollowUpBox.tsx";
import {
  formatCost,
  formatDuration,
  formatTokens,
  isCancelable,
  isLiveStatus,
  statusLabel,
} from "./format.ts";
import { statusTone } from "../statusTone.ts";
import { relativeAgo } from "../relativeTime.ts";

export function RunDetailPage(props: RunDetailPageProps): JSX.Element {
  const { run } = props;
  const now = new Date();
  const live = isLiveStatus(run.status);
  return (
    <div className="lr-detail">
      <div className="lr-head">
        <span className={`lr-dot lr-dot-${statusTone(run.status)}${live ? " live" : ""}`} />
        <div className="lr-head-main">
          <h1 className="lr-title">
            {run.loopName}
            {run.target ? <span className="lr-target">{run.target.label}</span> : null}
          </h1>
          <span className="lr-row-sub">
            {statusLabel(run.status)}
            {" · "}
            {relativeAgo(run.createdAt, now)}
            {run.durationMs !== undefined ? ` · ${formatDuration(run.durationMs)}` : ""}
            {run.usage
              ? ` · ${formatTokens(run.usage.inputTokens)} in · ${formatTokens(run.usage.outputTokens)} out · ${formatCost(run.usage.costUsd)}`
              : run.costUsd !== undefined
                ? ` · ${formatCost(run.costUsd)}`
                : ""}
          </span>
        </div>
        {isCancelable(run.status) ? (
          <button type="button" className="btn le-danger-btn" onClick={() => props.onCancel(run.id)}>
            Cancel run
          </button>
        ) : null}
      </div>

      {run.error ? <div className="le-server-issues" role="alert"><span className="le-error">{run.error}</span></div> : null}
      {run.summary ? <p className="lr-summary">{run.summary}</p> : null}

      <ActivityStream activities={run.activities} live={live} />

      <FollowUpBox status={run.status} onSend={(text) => props.onSend(run.id, text)} />
    </div>
  );
}
