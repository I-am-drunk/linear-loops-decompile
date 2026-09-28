var H = null,
  internals = {
    get H() { return H },
    set H(e) { H = e }
  };

function jsx(e, t) {
  return { $$typeof: Symbol.for(`react.transitional.element`), type: e, key: t.key ?? null, props: t }
}

function t() {
  return {
    version: `19.3.0-fake`,
    __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: internals
  }
}
export {
  t, jsx as j, internals as i
};
