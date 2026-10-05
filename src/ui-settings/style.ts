/**
 * Settings styles as a string (ST1).
 *
 * Every colour is a `--t-*` custom property produced by `src/ui-theme`'s
 * golden-tested generator. docs/plan/settings.md: "Tokens are defined once
 * and consumed by component; no component hardcodes a color." The test in
 * this package greps this file for hex and rgb literals and fails on one, so
 * the rule is mechanical rather than aspirational.
 *
 * Dimensions are our own design system, chosen once here rather than
 * recalled per slice: a 4px spacing ladder and a 3-step radius ladder.
 */

/** The ladders. Named so later slices reuse rather than re-invent. */
export const SPACE = { xs: `4px`, sm: `8px`, md: `12px`, lg: `16px`, xl: `24px`, xxl: `32px` };
export const RADIUS = { sm: `4px`, md: `6px`, lg: `8px` };
export const NAV_WIDTH = `208px`;
export const CONTENT_MAX = `calc(100% - 2 * var(--s-xl))`;

export const SETTINGS_CSS = `
.s-shell{display:flex;min-height:100vh;background:var(--t-bgBase);color:var(--t-labelBase)}
.s-nav{width:${NAV_WIDTH};flex:0 0 ${NAV_WIDTH};padding:${SPACE.lg} ${SPACE.sm};
  border-right:1px solid var(--t-bgBorderFaint);display:flex;flex-direction:column;gap:2px}
.s-navitem{display:block;padding:${SPACE.xs} ${SPACE.sm};border-radius:${RADIUS.sm};
  color:var(--t-labelMuted);text-decoration:none;font-size:13px;line-height:20px}
.s-navitem:hover{background:var(--t-bgShadeHover);color:var(--t-labelBase)}
.s-navitem[aria-current=page]{background:var(--t-sidebarLinkBgActive);color:var(--t-labelTitle)}
.s-main{flex:1 1 auto;min-width:0;padding:${SPACE.xxl} ${SPACE.xl}}
.s-page{max-width:640px}
.s-h1{font-size:22px;line-height:28px;font-weight:510;margin:0 0 ${SPACE.xl};color:var(--t-labelTitle)}
.s-h2{font-size:14px;line-height:20px;font-weight:510;margin:0 0 ${SPACE.xs};color:var(--t-labelTitle)}
.s-blurb{font-size:13px;line-height:18px;margin:0 0 ${SPACE.md};color:var(--t-labelMuted)}
.s-section{margin:0 0 ${SPACE.xxl}}
.s-rows{border:1px solid var(--t-bgBorderFaint);border-radius:${RADIUS.lg};overflow:hidden}
.s-row{display:flex;align-items:center;gap:${SPACE.lg};padding:${SPACE.md} ${SPACE.lg};
  border-top:1px solid var(--t-bgBorderFaint)}
.s-row:first-child{border-top:none}
.s-row.s-off{opacity:.5}
.s-rowtext{flex:1 1 auto;min-width:0}
.s-rowlabel{display:block;font-size:13px;line-height:18px;color:var(--t-labelBase)}
.s-rowdesc{margin:2px 0 0;font-size:12px;line-height:16px;color:var(--t-labelMuted)}
.s-rowctl{flex:0 0 auto;display:flex;align-items:center;gap:${SPACE.sm}}
.s-toggle{width:28px;height:16px;padding:2px;border:none;border-radius:999px;cursor:pointer;
  background:var(--t-bgBorderStrong);transition:background 120ms ease}
.s-toggle[aria-checked=true]{background:var(--t-controlPrimary)}
.s-toggle[disabled]{cursor:default}
.s-knob{display:block;width:12px;height:12px;border-radius:999px;background:var(--t-labelTitle);
  transform:translateX(0);transition:transform 120ms ease}
.s-toggle[aria-checked=true] .s-knob{transform:translateX(12px)}
.s-select,.s-input{font:inherit;font-size:13px;line-height:18px;padding:${SPACE.xs} ${SPACE.sm};
  border:1px solid var(--t-bgBorderSolid);border-radius:${RADIUS.sm};
  background:var(--t-controlSecondary);color:var(--t-labelBase)}
.s-input{min-width:220px}
.s-select:focus,.s-input:focus{outline:2px solid var(--t-focusColor);outline-offset:-1px}
.s-btn{font:inherit;font-size:12px;line-height:16px;padding:${SPACE.xs} ${SPACE.sm};cursor:pointer;
  border:1px solid var(--t-bgBorderSolid);border-radius:${RADIUS.sm};
  background:var(--t-controlSecondary);color:var(--t-labelBase)}
.s-btn:hover{background:var(--t-controlSecondaryHover)}
.s-cred,.s-detail{font-size:12px;line-height:16px;color:var(--t-labelMuted)}
.s-badge{font-size:12px;line-height:16px;padding:1px ${SPACE.sm};border-radius:${RADIUS.sm}}
.s-connected{background:var(--t-greenTint);color:var(--t-greenText)}
.s-disconnected{background:var(--t-bgShade);color:var(--t-labelMuted)}
.s-error{background:var(--t-redTint);color:var(--t-redText)}
.s-checking{background:var(--t-bgShade);color:var(--t-labelFaint)}
`;
