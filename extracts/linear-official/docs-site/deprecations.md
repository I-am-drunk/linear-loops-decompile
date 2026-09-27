# Deprecations policy — facts from linear.app/developers/deprecations (fetched 2026-09-27)

Source: https://linear.app/developers/deprecations

- No API versioning. Breaking changes: proactive outreach from Linear.
- Removed functionality can leave **non-functioning stubs** in the schema — an
  op that still resolves in the schema is NOT proof it still works. Changes how
  we read schema drift in the ~30-day check.
- `@deprecated` directives in the schema; `[API]`-prefixed entries in the
  Linear changelog are the drift feed.
