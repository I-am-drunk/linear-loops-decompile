// Hand-written stub for v4.9t2fVNdP.js (G8 case; original code).
// The real chunk is uuid-v4 over crypto.getRandomValues — ambient RNG. The
// tracker uses it only as an opaque `setupId`; this stub pins it to a
// deterministic counter sequence so the golden bytes are stable while the
// VALUE still changes per start() call (two trackers never share a setupId —
// the property the corpus relies on, preserved observably).
let n = 0;
export const t = () => `00000000-0000-4000-8000-${String(++n).padStart(12, `0`)}`;
