// Declared stub for types.7f0h45Sh.js (G15; original code; the G12-family
// module-level-browser-globals reason). The entry consumes exactly ONE
// export:
//
//   x -> an    the GraphQL template tag. Pinned VERBATIM from the raw source
//              (types.7f0h45Sh.js: `an=(e,...t)=>e.reduce((e,n,r)=>
//              `${e}${n}${r in t?t[r]:``}`,``)`) — a pure template join with
//              no parsing, so the produced document is a deterministic
//              string. The entry's template has zero interpolations, making
//              the join exercise only the base path; the pin keeps the code
//              shape identical anyway.
export const x = (e, ...t) => e.reduce((acc, s, r) => `${acc}${s}${r in t ? t[r] : ``}`, ``);
