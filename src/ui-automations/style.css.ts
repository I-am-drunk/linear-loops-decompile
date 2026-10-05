/**
 * Automations list styles (AU1).
 *
 * Reuses SPACE/RADIUS from src/ui-settings rather than inventing dimensions:
 * one ladder across the app is what makes surfaces look related.
 * Colours are --t-* tokens only; the test greps for literals.
 */

import { RADIUS, SPACE } from "../ui-settings/style.css.ts";

export const AUTOMATIONS_CSS = `
.a-page{max-width:900px;padding:${SPACE.xxl} ${SPACE.xl};color:var(--t-labelBase)}
.a-h1{font-size:1.125rem;line-height:24px;font-weight:550;margin:0 0 ${SPACE.lg};color:var(--t-labelTitle)}
.a-bar{display:flex;gap:${SPACE.sm};align-items:center;margin:0 0 ${SPACE.lg}}
.a-search{flex:1 1 auto;min-width:0}
.a-search,.a-filter{font:inherit;font-size:.8125rem;line-height:18px;padding:${SPACE.xs} ${SPACE.sm};
  border:1px solid var(--t-bgBorderSolid);border-radius:${RADIUS.sm};
  background:var(--t-controlSecondary);color:var(--t-labelBase)}
.a-search:focus,.a-filter:focus{outline:2px solid var(--t-focusColor);outline-offset:-1px}
.a-primary{font:inherit;font-size:.8125rem;line-height:18px;padding:${SPACE.xs} ${SPACE.md};cursor:pointer;
  border:1px solid transparent;border-radius:${RADIUS.sm};
  background:var(--t-controlPrimary);color:var(--t-controlPrimaryLabel)}
.a-primary:hover{background:var(--t-controlPrimaryHover)}
.a-rows{border:1px solid var(--t-bgBorderFaint);border-radius:${RADIUS.lg};overflow:hidden}
.a-row{display:flex;align-items:center;gap:${SPACE.lg};padding:${SPACE.md} ${SPACE.lg};
  border-top:1px solid var(--t-bgBorderFaint)}
.a-row:first-child{border-top:none}
.a-row:hover{background:var(--t-bgShadeHover)}
.a-disabled{opacity:.55}
.a-main{flex:1 1 auto;min-width:0}
.a-name{display:block;font-size:.8125rem;line-height:18px;color:var(--t-labelTitle);text-decoration:none}
.a-name:hover{color:var(--t-labelLink)}
.a-meta{margin-top:2px;font-size:.75rem;line-height:16px;color:var(--t-labelMuted)}
.a-tools,.a-run{flex:0 0 auto;display:flex;align-items:center;gap:${SPACE.xs}}
.a-state{flex:0 0 72px;font-size:.75rem;line-height:16px;color:var(--t-labelMuted)}
.a-actions{flex:0 0 auto;display:flex;gap:${SPACE.xs};opacity:0}
.a-row:hover .a-actions,.a-row:focus-within .a-actions{opacity:1}
.a-act{font:inherit;font-size:.75rem;line-height:16px;padding:2px ${SPACE.sm};cursor:pointer;
  border:1px solid var(--t-bgBorderSolid);border-radius:${RADIUS.sm};
  background:var(--t-controlSecondary);color:var(--t-labelBase)}
.a-act:hover{background:var(--t-controlSecondaryHover)}
.a-danger:hover{color:var(--t-redText);border-color:var(--t-redBase)}
.a-chip{font-size:.75rem;line-height:16px;padding:0 ${SPACE.xs};border-radius:${RADIUS.sm};
  background:var(--t-bgShade);color:var(--t-labelMuted)}
.a-dim{font-size:.75rem;line-height:16px;color:var(--t-labelFaint)}
.a-badge{font-size:.75rem;line-height:16px;padding:0 ${SPACE.xs};border-radius:${RADIUS.sm}}
.a-succeeded{background:var(--t-greenTint);color:var(--t-greenText)}
.a-failed{background:var(--t-redTint);color:var(--t-redText)}
.a-running{background:var(--t-blueTint);color:var(--t-blueText)}
.a-queued,.a-cancelled{background:var(--t-bgShade);color:var(--t-labelMuted)}
.a-empty{border:1px dashed var(--t-bgBorderFaint);border-radius:${RADIUS.lg};
  padding:${SPACE.xxl};text-align:center}
.a-emptyh{font-size:.9375rem;line-height:20px;font-weight:550;margin:0 0 ${SPACE.sm};
  color:var(--t-labelTitle)}
.a-emptyp{font-size:.8125rem;line-height:18px;margin:0 auto ${SPACE.lg};max-width:76ch;
  color:var(--t-labelMuted)}
`;
