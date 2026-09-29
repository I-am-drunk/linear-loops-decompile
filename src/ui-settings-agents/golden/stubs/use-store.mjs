// Hand-written stub for useStore.BpZDR8VN.js (G34 case; original code).
// The entry's hook reads the application store; the driver installs the
// store FIXTURE here before each probe via setStore(). Reading the store
// before the driver installs one throws loudly.
let store = null;
export const setStore = (s) => { store = s; };
export const t = () => {
  if (store === null) throw new Error(`G34 stub: useStore read before the driver installed a fixture`);
  return store;
};
