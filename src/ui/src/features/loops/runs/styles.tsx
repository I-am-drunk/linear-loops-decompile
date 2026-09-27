/**
 * T-703 — runs pages styles. Shell theme tokens only; lr-* prefixed.
 * Reuses le-* classes from the editor (segmented control, danger button)
 * and ll-empty from the list — same design language, one palette.
 */
import type { JSX } from "react";

export function RunsStyles(): JSX.Element {
  return (
    <style>{`
.lr-page { max-width: 860px; }
.lr-list { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-raised); overflow: hidden; margin-top: 12px; }
.lr-row {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  cursor: pointer; border-top: 1px solid var(--border);
}
.lr-list > .lr-row:first-child { border-top: 0; }
.lr-row:hover, .lr-row:focus-visible { background: var(--bg-hover); }
.lr-row:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--accent); }

.lr-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; margin: 4px; }
.lr-dot-success { background: var(--success); }
.lr-dot-danger { background: var(--danger); }
.lr-dot-warning { background: var(--warning); }
.lr-dot-accent { background: var(--accent); }
.lr-dot-muted { background: var(--text-faint); }
.lr-dot.live { animation: lr-pulse 1.2s ease-in-out infinite; }
@keyframes lr-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

.lr-row-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.lr-row-title { color: var(--text); font-weight: 500; display: flex; gap: 8px; align-items: center; }
.lr-row-sub { color: var(--text-faint); font-size: 12px; }
.lr-target {
  font-size: 11px; padding: 0 7px; border-radius: 99px;
  border: 1px solid var(--border-strong); color: var(--text-muted);
}

.lr-detail { max-width: 720px; }
.lr-head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 12px; }
.lr-head-main { flex: 1; min-width: 0; }
.lr-title { margin: 0; font-size: 18px; display: flex; gap: 8px; align-items: center; }
.lr-summary { color: var(--text-muted); margin: 0 0 12px; }

.lr-stream { border-left: 2px solid var(--border); margin: 0 0 16px 6px; padding-left: 14px; }
.lr-act { display: flex; gap: 10px; padding: 6px 0; align-items: baseline; }
.lr-act-label {
  flex: none; width: 76px; font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-faint);
}
.lr-act-text { min-width: 0; color: var(--text); }
.lr-act-thought .lr-act-text { color: var(--text-muted); font-style: italic; }
.lr-act-tool { font-weight: 500; }
.lr-act-args {
  margin-left: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; color: var(--text-muted); background: var(--bg-overlay);
  padding: 1px 5px; border-radius: 4px;
}
.lr-act-result { display: block; color: var(--text-faint); font-size: 12px; margin-top: 2px; }
.lr-act-elicit .lr-act-text { color: var(--warning); }
.lr-act-error .lr-act-text { color: var(--danger); }
.lr-act-steered .lr-act-text { color: var(--accent); }
.lr-choices { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.lr-choice {
  font-size: 12px; padding: 1px 8px; border-radius: 99px;
  border: 1px solid var(--border-strong); color: var(--text-muted);
}
.lr-tail { color: var(--accent); animation: lr-pulse 1.2s ease-in-out infinite; margin-top: 4px; }
.lr-muted { color: var(--text-faint); }

.lr-followup { display: flex; gap: 8px; align-items: center; }
.lr-followup .le-input { flex: 1; }
`}</style>
  );
}
