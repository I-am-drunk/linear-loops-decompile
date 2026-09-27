# Deprecations — facts from linear.app/developers/deprecations (fetched 2026-09-27)

Source: https://linear.app/developers/deprecations

- No API versioning. Breaking changes come with proactive outreach and ample
  notice.
- Removed functionality can leave a **non-functioning stub** in the schema "to
  prevent breakage in queries and mutations" — an op that still resolves in
  the schema is NOT proof it still works. (Load-bearing for the ~30-day drift
  check and for goose-route probing: verify behavior, not just schema
  presence.)
- `@deprecated` directives annotate deprecations in the schema; API changes
  are listed with an `[API]` prefix in the Linear changelog — that changelog
  is the drift feed.
