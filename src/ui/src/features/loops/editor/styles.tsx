/**
 * T-702 — editor styles. Same pattern as the list (React-19-hoisted
 * <style>, shell theme tokens only); classes are le-* prefixed.
 */
import type { JSX } from "react";

export function LoopEditorStyles(): JSX.Element {
  return (
    <style>{`
.le-page { max-width: 720px; }
.le-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.le-title { margin: 0; font-size: 18px; }
.le-head-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.le-publish { display: flex; align-items: center; gap: 10px; flex: none; }
.le-first-issue { max-width: 320px; text-align: right; }

.le-block {
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  background: var(--bg-raised); padding: 14px 16px; margin-bottom: 12px;
}
.le-block-title { margin: 0 0 10px; font-size: 13px; font-weight: 600; }

.le-field { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; min-width: 0; flex: 1; }
.le-label { font-size: 12px; color: var(--text-muted); }
.le-hint { font-size: 12px; color: var(--text-faint); }
.le-error { font-size: 12px; color: var(--danger); }
.le-row { display: flex; gap: 10px; align-items: flex-end; }
.le-col { display: flex; flex-direction: column; gap: 4px; }

.le-input {
  width: 100%; padding: 5px 8px; font: inherit; color: var(--text);
  background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--radius);
}
.le-input:focus { outline: none; border-color: var(--accent); }
.le-input::placeholder { color: var(--text-faint); }
.le-num { width: 72px; flex: none; }
.le-icon { width: 64px; flex: none; }
.le-color { width: 96px; flex: none; }
.le-tz { width: 160px; }
.le-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.le-textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
.le-textarea-sm { resize: vertical; min-height: 44px; }

.le-check { display: flex; gap: 6px; align-items: center; color: var(--text-muted); font-size: 13px; margin: 4px 0; }

.le-segment { display: inline-flex; border: 1px solid var(--border-strong); border-radius: var(--radius); overflow: hidden; margin-bottom: 10px; }
.le-segment-btn {
  padding: 4px 12px; border: 0; background: transparent; color: var(--text-muted);
  font: inherit; cursor: pointer;
}
.le-segment-btn + .le-segment-btn { border-left: 1px solid var(--border); }
.le-segment-btn.on { background: var(--bg-active); color: var(--text); font-weight: 500; }

.le-days { display: flex; gap: 4px; }
.le-day {
  padding: 3px 8px; border: 1px solid var(--border-strong); border-radius: var(--radius);
  background: transparent; color: var(--text-muted); font: inherit; font-size: 12px; cursor: pointer;
}
.le-day.on { background: var(--accent-soft); border-color: var(--accent); color: var(--text); }

.le-sched-foot { align-items: center; margin-top: 8px; }
.le-rrule {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px;
  color: var(--text-muted); background: var(--bg-overlay); padding: 2px 6px;
  border-radius: 4px; word-break: break-all;
}
.le-time-sep { color: var(--text-faint); }

.le-cond {
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 8px 10px; margin: 8px 0; background: var(--bg);
}
.le-cond-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.le-cond-kind { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.le-add { margin-top: 8px; }
.le-add-kind { max-width: 220px; }

.le-danger { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.le-danger-btn { border-color: var(--danger); color: var(--danger); }
.le-danger-btn:hover { background: rgba(229, 83, 75, 0.12); }

.le-server-issues {
  border: 1px solid var(--danger); border-radius: var(--radius-lg);
  background: rgba(229, 83, 75, 0.08); padding: 10px 14px; margin-bottom: 12px;
}
.le-server-issues ul { margin: 6px 0 0; padding-left: 18px; }
`}</style>
  );
}
