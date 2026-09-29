// imports BOTH math chunks so the closure carries the prefix collision.
import { n as a } from "./math.AAAA.js";
import { n as z } from "./math.ZZZZ.js";

function both(e, t) {
  return { a: a(e, t), z: z(e, t) }
}
export {
  both as p
};
