// Hand-written stub for jsx-runtime.BH9nBM82.js (G11 case; original code).
// The chunk calls the factory at MODULE EVAL (`var f = s()`), so the stub
// must return an object; jsx/jsxs/Fragment are used only inside the observer
// component render, which this case never executes — throw-on-use.
export const t = () => ({
  jsx: () => {
    throw new Error(`G11 stub: jsx called — no render in this case`);
  },
  jsxs: () => {
    throw new Error(`G11 stub: jsxs called — no render in this case`);
  },
  Fragment: Symbol.for(`react.fragment`),
});
