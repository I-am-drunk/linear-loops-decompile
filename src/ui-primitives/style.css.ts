/**
 * SH2 primitives stylesheet.
 *
 * Every dimension appears in ui-facts.json with a corpus citation naming the
 * style object it came from. Colours are --t-* variables published by
 * src/ui-shell/theme-css.ts; a colour literal here fails the gate.
 *
 * Read docs/UI-EXACTNESS.md before adding a value.
 */
export const PRIMITIVES_CSS = `
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  vertical-align: top;
  margin: 0;
  border: none;
  border-radius: 9999px;
  font-family: var(--t-font-regular);
  white-space: nowrap;
  cursor: pointer;
  text-decoration: none;
}
/* No gap: none of Button's 107 classes declares one. The 6px I first wrote
   here was invented, and it passed the gate only because 6px happens to be
   the INPUT padding — the same wrong-element failure as the sidebar-width
   case in docs/UI-EXACTNESS.md. Icon/label spacing is the icon component's
   business (SH2 follow-up). */

.btn[data-size="small"]  { height: 24px; min-width: 24px; font-size: 0.75rem;   padding: 0 8px; }
.btn[data-size="medium"] { height: 28px; min-width: 28px; font-size: 0.75rem;   padding: 0 10px; }
.btn[data-size="normal"] { height: 32px; min-width: 32px; font-size: 0.8125rem; padding: 0 12px; }
.btn[data-size="large"]  { height: 44px; min-width: 32px; font-size: 0.8125rem; padding: 0 18px; }

.input {
  appearance: none;
  box-sizing: border-box;
  width: 100%;
  padding-block: 6px;
  padding-inline: 12px;
  border-radius: 5px;
  font-family: var(--t-font-regular);
  font-size: 0.8125rem;
  font-feature-settings: "calt" 0;
  color: var(--t-label-base);
  background: var(--t-bg-base);
  border: 1px solid var(--t-bg-border);
  transition: border .15s;
}

/* No :focus rule. None of Input's 95 classes carries one, and the chunk has
   no focus reference at all — the focus ring lives elsewhere (ThemeHelper
   publishes a focusShadow, which is the likely home). Writing one here
   would be invented, so the field is deliberately focus-unstyled until it is
   read out of the corpus. */
`.trimStart();
