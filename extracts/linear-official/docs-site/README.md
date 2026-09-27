# docs-site — fact digests of linear.app/developers (the live official docs)

WHY THIS EXISTS: the vendored `../docs/*.md` from the `linear/linear` repo are
ONE-LINE STUBS ("Visit developers.linear.app…") — upstream moved the real docs to
the website. Anything in this repo citing "the vendored API.md" was citing an
empty file. This directory closes that hole.

LEGAL LINE (per `../README.md`, binding): the website text is NOT openly
licensed. These files are OUR digests — extracted facts, field lists, header
names, limits, and short quotes with the source URL — never wholesale copies.
When you need the prose, fetch the live page.

| File | Source page | Fetched |
|---|---|---|
| `rate-limiting.md` | linear.app/developers/rate-limiting | 2026-09-27 |
| `graphql-basics.md` | linear.app/developers/graphql | 2026-09-27 |
| `pagination-filtering.md` | linear.app/developers/pagination + /filtering | 2026-09-27 |
| `webhooks.md` | linear.app/developers/webhooks | 2026-09-27 |
| `oauth.md` | linear.app/developers/oauth-2-0-authentication | 2026-09-27 |
| `attachments.md` | linear.app/developers/attachments | 2026-09-27 |
| `file-uploads.md` | linear.app/developers/how-to-upload-a-file-to-linear | 2026-09-27 |
| `errors.md` | linear.app/developers/graphql + /sdk-errors | 2026-09-27 |
| `file-storage-auth.md` | linear.app/developers/file-storage-authentication | 2026-09-27 |
| `app-manifests.md` | linear.app/developers/oauth-app-manifests | 2026-09-27 |
| `customers.md` | linear.app/developers/managing-customers | 2026-09-27 |
| `deprecations.md` | linear.app/developers/deprecations | 2026-09-27 |
| `sdk-pointers.md` | sdk / sdk-fetching / advanced-usage / sdk-webhooks / migration | 2026-09-27 |

Agent-surface pages ({agents, agent-interaction, agent-best-practices,
agent-signals}) are digested in `../AGENT-API.md` — do not duplicate them here.

COMPLETENESS BAR: the page list is greppable from `linear.app/sitemap.xml`
(`developers/[a-z0-9-]*`, 26 pages as of 2026-09-27) — a page ADDED to the
sitemap is itself a delta the drift check must flag. The pages are
server-rendered; plain `curl` returns full HTML, no headless browser needed.
Every sitemap page is now digested here, in `../AGENT-API.md` (agent surface),
or explicitly pointed at (`sdk-pointers.md`).

Refresh rule: same cadence as the drift watch. Re-fetch the live pages, diff the
facts, update the digest + the `Fetched` date, and log deltas in KNOWLEDGE.md.
