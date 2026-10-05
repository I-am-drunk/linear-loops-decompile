/**
 * Node-tier stylesheet.
 *
 * Every dimension appears in ui-facts.json, cited to an --editor-* custom
 * property whose name states what it is for. Colours are --t-* variables.
 *
 * NO BACKTICKS below: this is a template literal, and one inside it
 * terminates the module. Guarded by a test.
 */
export const NODES_CSS = `
.doc {
  line-height: 1.6;
  color: var(--t-label-base);
}

.doc > * + * { margin-top: 1rem; }

.doc h1 { font-size: 1.375rem; }
.doc h2 { font-size: 1.1875rem; }
.doc h3 { font-size: 1.0625rem; }
.doc h4 { font-size: 0.9375rem; }
.doc h5 { font-size: 0.875rem; }
.doc h6 { font-size: 0.875rem; }

.doc ul, .doc ol { padding-left: 1.5rem; margin-top: 1rem; }
.doc li + li { margin-top: 0.375rem; } /* .375 x block-spacing */

.doc pre {
  border-radius: 6px;
  overflow-x: auto;
  background: var(--t-bg-sub);
}

.doc code { font-family: var(--t-font-monospace); }

.doc blockquote {
  margin-left: 0;
  padding-left: 1rem;
  color: var(--t-label-muted);
}

.doc a { color: var(--t-label-link); }
`.trimStart();
