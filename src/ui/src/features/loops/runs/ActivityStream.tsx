/**
 * T-703 — the run's activity stream: ordered thought/action/response/
 * elicitation/error/steered parts (SPECS/loops.md §run-view, SPECS/agent.md).
 * Streaming = the parent re-renders with grown parts; this component just
 * renders what it gets (a live tail marker shows while the run is live).
 */
import type { JSX } from "react";
import type { ActivityItem } from "./types.ts";

function ActivityRow(props: { readonly item: ActivityItem }): JSX.Element {
  const { item } = props;
  switch (item.kind) {
    case "thought":
      return (
        <div className="lr-act lr-act-thought" data-kind="thought">
          <span className="lr-act-label">Thought</span>
          <span className="lr-act-text lr-muted">{item.text}</span>
        </div>
      );
    case "action":
      return (
        <div className="lr-act lr-act-action" data-kind="action">
          <span className="lr-act-label">Action</span>
          <span className="lr-act-text">
            <span className="lr-act-tool">{item.label}</span>
            {item.argsSummary ? <code className="lr-act-args">{item.argsSummary}</code> : null}
            {item.resultSummary ? <span className="lr-act-result">→ {item.resultSummary}</span> : null}
          </span>
        </div>
      );
    case "response":
      return (
        <div className="lr-act lr-act-response" data-kind="response">
          <span className="lr-act-label">Loop</span>
          <span className="lr-act-text">{item.text}</span>
        </div>
      );
    case "elicitation":
      return (
        <div className="lr-act lr-act-elicit" data-kind="elicitation">
          <span className="lr-act-label">Question</span>
          <span className="lr-act-text">
            {item.prompt}
            {item.choices && item.choices.length > 0 ? (
              <span className="lr-choices">
                {item.choices.map((c) => (
                  <span key={c} className="lr-choice">{c}</span>
                ))}
              </span>
            ) : null}
          </span>
        </div>
      );
    case "error":
      return (
        <div className="lr-act lr-act-error" data-kind="error">
          <span className="lr-act-label">Error</span>
          <span className="lr-act-text">{item.message}</span>
        </div>
      );
    case "steered":
      return (
        <div className="lr-act lr-act-steered" data-kind="steered">
          <span className="lr-act-label">You steered</span>
          <span className="lr-act-text">{item.text}</span>
        </div>
      );
  }
}

export function ActivityStream(props: {
  readonly activities: readonly ActivityItem[];
  /** True while the run is live — a pulse marker trails the stream. */
  readonly live: boolean;
}): JSX.Element {
  const { activities, live } = props;
  return (
    <div className="lr-stream">
      {activities.map((a) => (
        <ActivityRow key={a.id} item={a} />
      ))}
      {live ? <div className="lr-tail" aria-label="streaming">●</div> : null}
      {activities.length === 0 && !live ? (
        <p className="lr-muted">No activity recorded for this run.</p>
      ) : null}
    </div>
  );
}
