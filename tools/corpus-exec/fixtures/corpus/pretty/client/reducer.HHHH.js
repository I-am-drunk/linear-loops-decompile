import { i as internals, j as jsx } from "./react.FAKE.js";

function Panel(e) {
  let [state] = internals.H.useReducer((s) => s, e.seed, (seed) => ({ doubled: seed * 2 }));
  return jsx(`div`, {
    children: String(state.doubled)
  })
}
export {
  Panel as t
};
