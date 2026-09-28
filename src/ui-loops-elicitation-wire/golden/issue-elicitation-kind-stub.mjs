// Declared stub for Issue.DRYymPCa.js (G15; original code; the G12 pattern).
// The model-layer chunk's module level needs browser globals (self.FormData
// via types.7f0h45Sh.js) and cannot execute under the runner; the entry
// consumes exactly ONE export:
//
//   Lg -> ek   the elicitation response-kind enum. Pinned VERBATIM from the
//              raw source (Issue.DRYymPCa.js, `ek=function(e){return
//              e.multipleChoice=`multipleChoice`,e.mcpServerConnection=
//              `mcpServerConnection`,e.confirmation=`confirmation`,
//              e.entitySelection=`entitySelection`,e}({})`).
//
// Any OTHER member read throws, so corpus drift that adds a kind (or a read
// of anything else) fails loudly instead of silently reusing stale pins.
export const Lg = new Proxy(
  {
    multipleChoice: `multipleChoice`,
    mcpServerConnection: `mcpServerConnection`,
    confirmation: `confirmation`,
    entitySelection: `entitySelection`,
  },
  {
    get(target, key) {
      if (typeof key === `symbol` || Object.hasOwn(target, key)) return target[key];
      throw new Error(`unpinned elicitation-kind enum (Lg/ek) read: ${String(key)}`);
    },
  },
);
