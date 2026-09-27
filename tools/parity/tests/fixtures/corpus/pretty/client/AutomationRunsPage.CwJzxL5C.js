const heading = `Loop runs`;
const empty = `No runs yet`;
const listMatch = match(`/:orgKey/loops/:viewType?`, pathname);
const header = {
  name: _jsx(G, {
    orderingKey: `name`,
    children: `Name`
  }),
  started: _jsx(G, {
    orderingKey: `started`,
    children: `Started`
  }),
  duration: _jsx(G, {
    orderingKey: `duration`,
    children: `Duration`
  }),
  activeOrderingKey: `decoy`
};
const filters = [{
  key: `status`,
  name: `Status`,
  values: []
}, {
  key: `team`,
  name: `Team`,
  values: []
}];
const emptyState = hasFilters ? `No matching runs` : `No runs to show`;
const cls = isActive ? `activeRow` : `row`;
const expr = ok ? `Done` : fallbackFn();
