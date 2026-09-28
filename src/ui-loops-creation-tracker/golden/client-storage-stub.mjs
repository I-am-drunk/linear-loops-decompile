// Hand-written stub for ClientStorage.2mwQyaxr.js (G8 case; original code).
// The real chunk writes window.localStorage (module-level it also touches
// window.__toStaticUrl via its Vite dep map) — browser ambient the sandbox
// must not fake silently. This stub is an in-memory store that PRESERVES the
// contract the tracker relies on (set stores a JSON-serializable snapshot;
// get returns a structurally-equal copy or undefined) and RECORDS every call
// so the driver can serialize the storage traffic as part of the golden —
// the persistence behavior is observed, not discarded. Only get/set are
// implemented: any other ClientStorage method the tracker might grow to call
// throws loudly (never a silent no-op).
const store = new Map();
export const writes = [];
const snapshot = (v) => JSON.parse(JSON.stringify(v));
const bag = {
  get(key) {
    return store.has(key) ? snapshot(store.get(key)) : undefined;
  },
  set(key, value) {
    const snap = snapshot(value);
    store.set(key, snap);
    writes.push({ key, value: snap });
    return true;
  },
};
export const t = new Proxy(bag, {
  get(target, prop) {
    if (prop in target) return target[prop];
    throw new Error(`G8 ClientStorage stub: unpinned method ${String(prop)} — extend the stub deliberately`);
  },
});
