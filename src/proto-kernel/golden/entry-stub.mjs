// Stub for entry.BGeHYrTB.js — the boot chunk's final act is a dynamic
// import of the app entry (B7), which would cascade the application
// (react-dom, mobx store install, service-worker registration) into the
// sandbox. The entry is not under test: this case pins the PROTOTYPE
// INSTALLS that `b()` performs before that import. An inert module keeps the
// dynamic import resolving (so the boot chunk's failure path
// `window.__showLoadingError` never fires) while nothing app-shaped runs.
export {};
