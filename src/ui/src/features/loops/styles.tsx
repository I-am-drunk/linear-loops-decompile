/**
 * Loops feature styles (T-701). Emitted once near the page (React 19 hoists
 * <style>; idempotent). Built entirely on the shell's theme tokens
 * (theme.css) — no second palette. Classes are ll-* prefixed.
 */
import type { JSX } from "react";

export function LoopsStyles(): JSX.Element {
  return (
    <style>{`
.ll-page { max-width: 860px; }

.ll-toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 16px; }
.ll-search {
  flex: 1; max-width: 320px; padding: 5px 10px; font: inherit; color: var(--text);
  background: var(--bg-raised); border: 1px solid var(--border-strong); border-radius: var(--radius);
}
.ll-search:focus { outline: none; border-color: var(--accent); }
.ll-search::placeholder { color: var(--text-faint); }

.ll-group { margin-bottom: 20px; }
.ll-group-title {
  margin: 0 0 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; color: var(--text-faint);
}
.ll-group-rows {
  border: 1px solid var(--border); border-radius: var(--radius-lg);
  background: var(--bg-raised); overflow: hidden;
}

.ll-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  cursor: pointer; border: 0; border-top: 1px solid var(--border);
}
.ll-group-rows > .ll-row:first-child { border-top: 0; }
.ll-row:hover, .ll-row:focus-visible { background: var(--bg-hover); }
.ll-row:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--accent); }

.ll-tile {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; flex: none; border-radius: var(--radius);
  background: var(--bg-overlay); border: 1px solid var(--border);
  color: var(--text-muted); font-size: 14px; line-height: 1;
}
.ll-tile[style*="background-color"] { color: #fff; }
.ll-tile-emoji { font-size: 14px; }

.ll-row-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.ll-row-name {
  color: var(--text); font-weight: 500; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.ll-row-sub { color: var(--text-faint); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.ll-chip {
  flex: none; padding: 1px 8px; border-radius: 99px; font-size: 11px;
  border: 1px solid var(--border-strong); color: var(--text-muted);
}
.ll-chip-success { color: var(--success); border-color: transparent; background: rgba(87, 171, 90, 0.14); }
.ll-chip-danger { color: var(--danger); border-color: transparent; background: rgba(229, 83, 75, 0.14); }
.ll-chip-warning { color: var(--warning); border-color: transparent; background: rgba(212, 167, 44, 0.14); }
.ll-chip-accent { color: var(--accent); border-color: transparent; background: var(--accent-soft); }
.ll-chip-muted { color: var(--text-faint); }

.ll-switch {
  flex: none; position: relative; width: 30px; height: 18px; padding: 0;
  border-radius: 99px; border: 1px solid var(--border-strong);
  background: var(--bg-overlay); cursor: pointer;
}
.ll-switch.on { background: var(--accent); border-color: transparent; }
.ll-switch-knob {
  position: absolute; top: 1px; left: 1px; width: 14px; height: 14px;
  border-radius: 50%; background: var(--text); transition: left 0.12s ease;
}
.ll-switch.on .ll-switch-knob { left: 13px; background: #fff; }
.ll-switch:focus-visible { outline: none; box-shadow: 0 0 0 2px var(--accent-soft); }

.ll-empty {
  max-width: 560px; margin: 48px auto; padding: 24px; text-align: center;
  border: 1px dashed var(--border-strong); border-radius: var(--radius-lg);
  background: var(--bg-raised);
}
.ll-empty h1 { margin: 0 0 8px; font-size: 16px; }
.ll-empty p { margin: 6px 0; color: var(--text-muted); }
`}</style>
  );
}
