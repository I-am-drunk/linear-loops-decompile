/** Cursor 3.23.12 list geometry; Linear theme bindings. See ui-facts.json. */
export const AUTOMATIONS_CSS = `
.a-page{box-sizing:border-box;width:100%;max-width:60rem;margin:0 auto;padding:4rem 3rem;color:var(--t-labelBase)}
.a-chunks,.a-body{display:flex;flex-direction:column;align-items:stretch;gap:56px}
.a-toolbar-section{display:flex;flex-direction:column;gap:12px}
.a-pagehead{display:flex;flex-direction:column;align-items:flex-start;gap:4px;width:100%;padding:0 8px;box-sizing:border-box}
.a-title-row{display:flex;align-items:center;gap:12px;width:100%}
.a-title-group{display:flex;align-items:center;gap:8px;min-width:0}
.a-content-row{display:flex;align-items:flex-start;gap:12px;width:100%}
.a-title-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:auto}
.a-h1{font-weight:normal;margin:0;font-size:17px;line-height:21px;letter-spacing:.08px}
.a-description{margin:0;font-size:13px;line-height:18px;letter-spacing:-.08px;color:var(--t-labelMuted)}
.a-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 8px}
.a-filters{display:flex;flex-wrap:wrap;align-items:center;gap:1px}
.a-tabs{display:inline-flex;flex-wrap:wrap;align-items:center;gap:2px}
.a-tabs>button{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;appearance:none;border-style:none;background:transparent;margin:0;border-radius:9999px;padding:5px 10px;font-family:inherit;font-size:13px;line-height:18px;letter-spacing:-.08px;color:var(--t-labelMuted)}
.a-tabs>button:hover,.a-tabs>button[aria-selected="true"]{background:var(--t-bgShade);color:var(--t-labelBase)}
.a-toolbar-actions{display:flex;align-items:center;gap:8px}
.a-search-wrap{width:160px;min-width:120px;max-width:160px}
.a-search-group{box-sizing:border-box;display:flex;align-items:center;width:100%;height:28px;border-radius:6px;gap:6px;padding:4px 8px;border:1px solid var(--t-bgBorderSolid);background:var(--t-bgBase)}
.a-search{flex:1;min-width:0;margin:0;padding:0;border:0;background:transparent;font-family:inherit;font-size:13px;line-height:18px;letter-spacing:0;color:inherit}
.a-table{width:100%;box-sizing:border-box;overflow:hidden;padding:4px 6px 6px;border:1px solid var(--t-bgBorderFaint);border-radius:12px;background:var(--t-bgBase)}
.a-headrow,.a-row{display:flex;align-items:stretch;gap:12px;padding:0 8px}
.a-headrow{font-size:12px;line-height:16px;font-weight:normal;border-bottom:1px solid transparent;color:var(--t-labelMuted)}
.a-rows{font-size:13px;line-height:20px}
.a-cell{display:flex;align-items:center;padding:12px 2px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.a-name,.a-author{flex:2 1 0;min-width:100px}
.a-status,.a-tools{flex:1 1 0;min-width:0}
.a-actions{flex:0 0 40px;width:40px;justify-content:flex-end}
.a-rowlink{display:contents;color:inherit;font:inherit;text-align:inherit}
.a-author-meta{display:flex;align-items:center;width:100%;min-width:0;gap:6px}
.a-author-name{min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.a-date{flex-shrink:0;color:var(--t-labelMuted)}
.a-status-label{font-size:13px;line-height:18px}
.a-row{position:relative}
.a-row::before{content:"";position:absolute;top:0;left:8px;right:8px;height:1px;background:var(--t-bgBorderFaint);pointer-events:none}
.a-row:hover{border-radius:6px;background:var(--t-bgShadeHover)}
.a-row:hover::before,.a-row:hover+.a-row::before{display:none}
.a-row:has(.a-rowlink:focus-visible){border-radius:6px;outline:2px solid var(--t-labelBase);outline-offset:-2px}
.a-empty{box-sizing:border-box;border:1px solid var(--t-bgBorderFaint);border-radius:12px;background:var(--t-bgBase);padding:32px 16px;text-align:center}
.a-emptyh{font-size:13px;line-height:18px;color:var(--t-labelMuted)}
.a-emptyp{max-width:28rem;margin:4px auto 0;font-size:13px;line-height:18px;color:var(--t-labelFaint)}
.a-empty-create{margin-top:16px}
.a-create,.a-empty-create{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;border-radius:9999px;padding:0 12px;height:28px;font:inherit;font-size:13px;line-height:18px;letter-spacing:-.08px;font-weight:normal;white-space:nowrap;cursor:pointer;background:var(--t-controlPrimary);color:var(--t-controlPrimaryLabel)}
.a-empty-create{height:24px;padding:0 10px;border-color:var(--t-bgBorderSolid);background:transparent;color:var(--t-labelBase)}
.a-create:hover{background:var(--t-controlPrimaryHover)}
.a-all-runs{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:20px;border:1px solid transparent;border-radius:4px;padding:0 6px;margin:0;font:inherit;font-size:13px;line-height:18px;letter-spacing:-.08px;white-space:nowrap;background:transparent;color:var(--t-labelMuted);cursor:pointer}
.a-menu-trigger,.a-page-arrow{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border:0;border-radius:4px;padding:0;margin:0;appearance:none;background:transparent;color:var(--t-labelMuted);font:inherit;cursor:pointer}
.a-menu-trigger:hover,.a-page-arrow:hover{background:var(--t-bgShade)}
.a-pagination{margin-top:4px;padding:8px 10px;font-size:13px;line-height:18px}
@media(max-width:639px){.a-page{padding:1.5rem}}
`;
