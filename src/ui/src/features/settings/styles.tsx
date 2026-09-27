/**
 * Settings feature styles. Emitted once near the root (React 19 hoists
 * <style> tags; idempotent). Uses the shell's theme tokens — no second palette.
 */
import type { JSX } from "react";

export function SettingsStyles(): JSX.Element {
  return (
    <style>{`
.st-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); max-width: 900px; }
.st-card {
  display: block; padding: 14px 16px; border: 1px solid var(--border);
  border-radius: var(--radius-lg); background: var(--bg-raised);
}
.st-card:hover { border-color: var(--border-strong); background: var(--bg-overlay); }
.st-card h2 { margin: 0 0 4px; font-size: 14px; color: var(--text); }
.st-card p { margin: 0; color: var(--text-muted); }
.st-card .st-state { margin-top: 8px; font-size: 12px; }

.st-panel { max-width: 640px; border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-raised); padding: 16px; }
.st-panel + .st-panel { margin-top: 16px; }
.st-panel h2 { margin: 0 0 10px; font-size: 14px; }
.st-row { display: flex; gap: 8px; align-items: center; margin: 8px 0; }
.st-row.wrap { flex-wrap: wrap; }
.st-label { width: 130px; flex: none; color: var(--text-muted); font-size: 12px; }
.st-input, .st-select {
  flex: 1; min-width: 0; padding: 5px 8px; font: inherit; color: var(--text);
  background: var(--bg); border: 1px solid var(--border-strong); border-radius: var(--radius);
}
.st-input:focus, .st-select:focus { outline: none; border-color: var(--accent); }
.st-hint { color: var(--text-faint); font-size: 12px; margin: 4px 0 0; }
.st-error { color: var(--danger); font-size: 12px; }
.st-ok { color: var(--success); font-size: 12px; }
.st-muted { color: var(--text-muted); font-size: 12px; }
.st-kv { display: flex; gap: 6px; margin: 4px 0; }
.st-kv .st-input { flex: 1; }
.st-badge {
  display: inline-block; padding: 1px 7px; border-radius: 99px; font-size: 11px;
  border: 1px solid var(--border-strong); color: var(--text-muted);
}
.st-badge.ok { color: var(--success); border-color: var(--success); }
.st-badge.warn { color: var(--warning); border-color: var(--warning); }
.st-harness {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-raised);
  margin: 8px 0;
}
.st-harness .st-name { font-weight: 600; }
.st-harness .st-meta { color: var(--text-muted); font-size: 12px; }
.st-harness .st-actions { margin-left: auto; display: flex; gap: 6px; }
.st-meter { height: 4px; border-radius: 2px; background: var(--bg-overlay); overflow: hidden; margin-top: 6px; }
.st-meter > div { height: 100%; background: var(--accent); }
.st-dl { display: grid; grid-template-columns: 130px 1fr; gap: 6px 12px; margin: 0; }
.st-dl dt { color: var(--text-muted); font-size: 12px; }
.st-dl dd { margin: 0; font-family: ui-monospace, monospace; font-size: 12px; }
`}</style>
  );
}

