// Hand-written stub for resolvePromise.B8FauNXm.js (G34 case; original code).
// The entry consumes exactly one member, `a` (the suspending
// resolve-with-reset hook: a(thunk, {resetKey})). The stub RECORDS the call
// (the thunk and the resetKey are the observed facts) and invokes the thunk
// synchronously so its body (`organization.allUsers.hydrate()`) executes
// against the recording fixture — the hydrate call is observed there. The
// real chunk's suspense machinery is ambient/React-tier and stays GAP.
export const calls = [];
export const a = (thunk, opts) => {
  calls.push({ thunk, resetKey: opts?.resetKey, optsKeys: Object.keys(opts ?? {}) });
  thunk();
};
