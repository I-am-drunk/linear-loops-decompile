/** Settings primitives. Element-specific evidence and gaps: UI-REFERENCE.md. */

/** Compatibility exports; never a settings geometry spec. */
export const SPACE = { xs: `4px`, sm: `6px`, md: `8px`, lg: `12px`, xl: `16px`, xxl: `24px` };
export const RADIUS = { sm: `2px`, md: `3px`, lg: `8px` };

export const SETTINGS_CSS = `
.s-shell {
  --s-thin-pixel: 1px;
  display: flex;
  background: var(--t-bgBase);
  color: var(--t-labelBase);
  font-family: "Inter Variable", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", "Linear Thai", sans-serif;
}
.s-shell, .s-shell *, .s-shell *::before, .s-shell *::after { box-sizing: border-box; }
.s-h1, .s-h2, .s-blurb, .s-rowdesc, .s-section { margin: 0; padding: 0; border: 0; }
.s-nav { flex-shrink: 0; width: var(--s-sidebar-width, 244px); }
.s-navitems { padding: 4px 12px; }
.s-navitem {
  display: flex; align-items: center; position: relative;
  margin: 1px 0; padding-left: 10px; border-radius: 8px; text-decoration: none;
}
.s-navtext {
  display: flex; align-items: center; flex-grow: 1; height: 28px;
  padding: 0 9px 0 6px; border-radius: 8px;
  font-size: .8125rem; line-height: normal; font-weight: 500; color: var(--t-labelMuted);
}
.s-navitem[aria-current=page] { background: var(--t-sidebarLinkBgActive); }
.s-navitem[aria-current=page] .s-navtext { color: var(--t-labelTitle); }
.s-main {
  flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center;
  margin: 0 40px 64px;
}
.s-page { width: 100%; max-width: 640px; }
.s-pagehead { display: flex; flex-direction: column; gap: 4px; padding: 0 16px; text-indent: -.09rem; }
.s-pagegap { height: 32px; flex-shrink: 0; }
.s-sectionstack { display: flex; flex-direction: column; gap: 48px; }
.s-h1 { font-size: 1.5rem; line-height: 2rem; font-weight: 500; letter-spacing: -.01rem; color: var(--t-labelTitle); }
.s-h2 { font-size: .9375rem; line-height: 1.4375rem; font-weight: 500; color: var(--t-labelTitle); }
.s-blurb { font-size: .8125rem; line-height: 22px; font-weight: 450; color: var(--t-labelMuted); }
.s-section { display: flex; flex-direction: column; gap: 16px; padding-top: 12px; margin-top: -12px; min-width: 0; }
.s-sectionhead { display: flex; flex-direction: column; gap: 2px; padding-inline: 16px; }
.s-rows { border-radius: 10px; background: var(--t-bgBase); box-shadow: 0 0 0 var(--s-thin-pixel) var(--t-bgBorderFaintAlphaThin), var(--t-shadowLow); }
.s-row { display: flex; position: relative; min-height: 60px; padding: 16px; gap: 12px; align-items: center; justify-content: space-between; }
.s-row:not(:last-child)::after { content: ''; position: absolute; bottom: 0; left: 16px; right: 16px; border-bottom: var(--s-thin-pixel) solid var(--t-bgBorderFaintAlphaThin); }
.s-rowtext { display: flex; flex-direction: column; flex-grow: 1; min-width: 0; gap: 3px; }
.s-rowlabel { font-size: .8125rem; line-height: normal; font-weight: 500; color: var(--t-labelTitle); }
.s-rowdesc { font-size: .75rem; line-height: normal; font-weight: 450; color: var(--t-labelMuted); }
.s-rowctl { display: flex; flex-shrink: 0; min-width: 0; gap: 4px; }
.s-toggle-ctl { padding-right: 6px; }
.s-row.s-off .s-rowtext { opacity: .5; }
.s-toggle { position: relative; flex-shrink: 0; width: 30px; height: 20px; margin: 0; padding: 0; border: 0; border-radius: 72px; background: var(--s-toggle-track-off); }
.s-toggle[aria-checked=true] { background: var(--t-controlPrimary); }
.s-toggle:disabled { opacity: .5; }
.s-knob { position: absolute; top: 50%; left: 3px; right: 13px; height: 14px; border-radius: 7px; transform: translateY(-50%); background: var(--t-controlPrimaryLabel); }
.s-toggle[aria-checked=true] .s-knob { left: 13px; right: 3px; }
.s-input, .s-select { font-family: inherit; font-size: .8125rem; height: 32px; padding: 6px 12px; border-radius: 5px; margin: 0; color: var(--t-labelTitle); }
.s-input { appearance: none; background: var(--t-bgBase); border: var(--s-thin-pixel) solid var(--t-bgBorderSolidThin); outline-offset: -1px; }
.s-select { padding-right: 24px; background: var(--t-controlSecondary); border: var(--s-thin-pixel) solid transparent; }
.s-input:disabled, .s-select:disabled { color: var(--t-labelMuted); }
.s-btn {
  display: inline-flex; align-items: center; justify-content: center; position: relative; flex-shrink: 0;
  font-family: inherit; font-size: .8125rem; font-weight: 500; line-height: normal;
  height: 32px; min-width: 32px; margin: 0; padding: 0 12px; border-radius: 9999px;
  border: var(--s-thin-pixel) solid transparent; background: var(--t-controlSecondary); color: var(--t-labelBase);
}
.s-btn:disabled { opacity: .6; color: var(--t-labelMuted); }
.s-cred, .s-detail, .s-badge { font-size: .75rem; line-height: normal; font-weight: 450; color: var(--t-labelMuted); }
.s-shell :focus-visible { outline: 1px solid var(--t-focusColor); }
.s-navitem:focus-visible { outline-offset: -1px; }
.s-toggle:focus-visible { outline-offset: 2px; }
@media (max-width: 640px) {
  .s-main { margin-inline: 22px; margin-bottom: 32px; }
  .s-pagegap { height: 24px; }
  .s-sectionstack { gap: 24px; }
  .s-blurb { line-height: 18px; }
  .s-row { padding-inline: calc(16px / 1.5); gap: calc(12px / 1.5); }
}
@supports (animation-timeline: auto) {
  .s-navitems { padding-top: 26px; }
}
@media only screen and (min-device-pixel-ratio: 2), only screen and (min-resolution: 192dpi) {
  .s-shell { --s-thin-pixel: .5px; }
}
`;
