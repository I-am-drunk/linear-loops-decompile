/**
 * SH1 shell stylesheet.
 *
 * Every dimension here appears in ui-facts.json with a corpus citation naming
 * the element or constant key it came from. Colours are --t-* variables from
 * src/ui-theme; a literal here fails ci/check-src.sh.
 *
 * Read docs/UI-EXACTNESS.md before adding a value.
 */
export const SHELL_CSS = `
* { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--t-bg-base);
  color: var(--t-label-base);
  font-family: var(--t-font-regular);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

#root { height: 100%; }

/* The shell: sidebar + content. mainPageMargin inset on the content side, as
   LinearLayout applies it (bt.mainPageMargin). */
.layout {
  display: flex;
  height: 100%;
}

/* PageSidebarContainer sidebarLeft: a right border, not a background slab.
   sidebarPadding from the layout constants. */
.sidebar {
  display: flex;
  flex-direction: column;
  flex: none;
  padding: 12px;
  border-right: 1px solid var(--t-bg-border-faint);
  background: var(--t-bg-sub);
  overflow-y: auto;
}

.content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  margin: 8px;
  border-radius: 12px;
  background: var(--t-bg-base);
}
`.trimStart();
