/**
 * Shell stylesheet, emitted as a string so the build has no CSS pipeline.
 *
 * Every colour is a `--t-*` variable from `theme-css.ts`. If a literal colour
 * appears here, that is a bug — the token set is the single source.
 */
export const SHELL_CSS = `
* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--t-bg-base);
  color: var(--t-label-base);
  font: 14px/1.5 "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* #root is the only child of body and must pass the full height through, or
   the sidebar stops short of the viewport. */
#root { height: 100%; }

.layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  height: 100%;
}

.sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px 10px;
  background: var(--t-bg-sub);
  border-right: 1px solid var(--t-bg-border-faint);
  overflow-y: auto;
}

.brand {
  padding: 4px 8px;
  font-weight: 600;
  font-size: 13px;
  color: var(--t-label-title);
}

.nav-group { display: flex; flex-direction: column; gap: 1px; }

.nav-label {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--t-label-faint);
}

.nav-item {
  display: block;
  padding: 6px 8px;
  border-radius: 5px;
  color: var(--t-label-muted);
  text-decoration: none;
  font-size: 13px;
}

.nav-item:hover { background: var(--t-bg-shade-hover); color: var(--t-label-base); }

.nav-item[aria-current="page"] {
  background: var(--t-bg-selected);
  color: var(--t-label-title);
  font-weight: 500;
}

.content { overflow-y: auto; }
.content-slot { padding: 28px 32px; max-width: 860px; }

.placeholder h1 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: var(--t-label-title);
}

.placeholder p { margin: 0; color: var(--t-label-faint); }
`.trimStart();
