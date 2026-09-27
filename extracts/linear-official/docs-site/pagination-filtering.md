# Pagination + filtering — facts from linear.app/developers/{pagination,filtering} (fetched 2026-09-27)

Sources: https://linear.app/developers/pagination · https://linear.app/developers/filtering

## Pagination

- Relay-style cursors: `first`/`after`, `last`/`before`; `edges { node cursor }`
  + `pageInfo { hasNextPage endCursor }`; simpler `nodes` syntax also supported.
- Default page size: **50** with no arguments.
- Default order `createdAt`; `orderBy: updatedAt` available (recommended for
  incremental fetches).

## Filtering

- `filter:` argument on most paginated fields; conditions AND-merge by default;
  `or: [...]` switches to OR.
- Comparators (string/number/date): `eq neq in nin`.
- Number/date extras: `lt lte gt gte`.
- String extras: `eqIgnoreCase neqIgnoreCase startsWith notStartsWith endsWith
  notEndsWith contains notContains containsIgnoreCase notContainsIgnoreCase`.
- Optional fields: `null: true|false`.
- Relationship filters nest (`assignee: { email: { eq: … } } }`); many-to-many
  matches ANY by default, `every: { … }` for ALL.
- Relative time on date fields: ISO 8601 durations, e.g. `dueDate: { lt: "P2W" }`,
  negative offsets like `completedAt: { gt: "-P2W" }`.
