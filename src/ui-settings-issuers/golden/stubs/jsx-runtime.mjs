// Hand-written stub for jsx-runtime.BH9nBM82.js (G25 case; original code).
// The chunk calls the factory at MODULE EVAL (`j = _()`); jsx/jsxs are used
// only inside the component body — throw-on-use (the G14/G17 seam).
export const t = () => ({
  jsx: () => {
    throw new Error(`G25 stub: jsx called — no render in this case`);
  },
  jsxs: () => {
    throw new Error(`G25 stub: jsxs called — no render in this case`);
  },
  Fragment: Symbol.for(`react.fragment`),
});
