// Hand-written stub for jsx-runtime.BH9nBM82.js (G14 case; original code).
// The chunk calls the factory at MODULE EVAL (`var c = r()`), so the stub
// must return an object; jsx is used only inside the two component bodies,
// which this case never executes — throw-on-use.
export const t = () => ({
  jsx: () => {
    throw new Error(`G14 stub: jsx called — no render in this case`);
  },
  jsxs: () => {
    throw new Error(`G14 stub: jsxs called — no render in this case`);
  },
  Fragment: Symbol.for(`react.fragment`),
});
