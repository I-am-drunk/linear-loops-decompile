import { t as getReact, j as jsx, i as internals } from "./react.FAKE.js";
import { l as flag } from "./provider.DDDD.js";

function Widget(e) {
  let theme = internals.H.useContext(null),
    label = internals.H.useMemo(() => e.name ?? `Untitled`);
  return jsx(`div`, {
    className: flag ? `retina` : `standard`,
    children: jsx(`span`, {
      style: { color: theme.color.labelBase },
      children: label
    })
  })
}
export {
  Widget as t
};
