# R-BOOT — the boot/config plane (what runs before the first component mounts)

Shard: R-BOOT (docs/remap/shards.md). Claimed on #225 at 2026-09-29T16:22:39Z by
sess_01a0edec-d03b-76e2-8995-ac369b949927. Research input harvested: my own
#295 16:21Z BOOT/CONFIG-plane leg (the complete read; no prior input touches
this ground — verified by grepping the full thread for `config.Uz`,
`injectConfig`, `CLIENT_ENV`, `prototype`, `serviceWorker`, `index.html`).

Evidence chunks at `c44f2cf` (Linear v1.32.4): `html.CjyPLfH8.js` (11.9 KB —
the compiled `index.html` module), `entry.BGeHYrTB.js` (35.9 KB),
`config.aM1_XCHx.js` (655 B), `config.Uz-QjVze.js` (11.1 KB),
`Logger.qFaEBF6-.js` (Sentry init, ~L11961), `RefreshManager.DpVjn8XM.js`
(PostHog key sites), `app/asar-src/out/main/server.js` (DesktopServer),
`app/asar-src/out/renderer/error.html`.

This plane adds no routes to the denominator — it is spine, not surface. Its
rows gate A1: the prototype kernel (§2) and the config seam (§3) must land in
or before A1's first assembly slice, because transcribed chunks assume both at
module eval.

Column vocabulary per `docs/remap/README.md`.

## 1. Boot-order row group (the spine itself)

Boot order read top-to-bottom in `html.CjyPLfH8.js`, then `entry.BGeHYrTB.js`:

| # | Step | Evidence site | Disposition | Golden-req | Data plane |
|---|---|---|---|---|---|
| B1 | modulepreload polyfill (MutationObserver over `link[rel=modulepreload]`; crossOrigin→credentials map) | html.CjyPLfH8 top IIFE | ADAPT (modern browsers; keep the credentials map if kept at all) | no | N-A |
| B2 | `b()` — prototype-extension installer | html.CjyPLfH8 `b()` | KEEP-EXACT — see §2 | yes (b) | N-A |
| B3 | `injectConfig(CONFIG)` — config seam wiring | html.CjyPLfH8, imports from both config chunks | KEEP-EXACT — see §3 | yes (b),(c) | N-A |
| B4 | `window.__toStaticUrl = e => ASSET_URL + e (+ '?' + CACHE_BUST)` | html.CjyPLfH8 | KEEP-EXACT (every `__vite__mapDeps` table in all 1,550 chunks calls it) | yes (b) — one tiny golden with B3 | N-A |
| B5 | `jitless: true` init; `requestIdleCallback`/`cancelIdleCallback` polyfills | html.CjyPLfH8 | KEEP-EXACT (cheap) | no | N-A |
| B6 | Electron locale patch: validate `window.__electronSystemLocale__` via `new Intl.Locale` (strip `@`-suffix, fall back `en-US`), REPLACE `Intl.DateTimeFormat`/`Intl.NumberFormat` constructors with locale-defaulting wrappers (`Object.setPrototypeOf` preserved), redefine `navigator.language`/`languages` getters | html.CjyPLfH8 | OUT (desktop-only; we ship no Electron shell). NOTE for the harness: this is why every tz/locale golden is ambient-sensitive — first-party desktop pins ambient locale at boot | no | N-A |
| B7 | dynamic-import `entry.BGeHYrTB.js` (96-dep preload list); failure → `window.__clearEntryLoadTimeout?.()` + `window.__showLoadingError?.('script-error', err)` | html.CjyPLfH8 tail | KEEP-EXACT structure; the two `window.__*` hooks are defined in the MISSING index.html — see §6 | no | N-A |
| B8 | app-store context install; `mobx configure({enforceActions:'never', isolateGlobalState:true})`; deduped `onReactionError` logger (2 s suppression window per reaction name) | entry.BGeHYrTB | KEEP-EXACT | yes (b) — the dedupe window is a pinned value | N-A |
| B9 | scrollbar probe: 30px div, obtrusive scrollbar ⇒ body class `layoutScrollbarObtrusive` | entry.BGeHYrTB `B()` | KEEP-EXACT (style-plane interlock: R-STYLE) | yes (b) small | N-A |
| B10 | service-worker registration | entry.BGeHYrTB `R()`/`l()` | ADAPT — see §5 | no | N-A |
| B11 | skip-bootstrap route list: `['/mobile-auth','/auth/redirect','/oauth/authorize','/connect/','/__review-preview-frame']` + `connectivity-probe` search param ⇒ `store.skipBootstrap()` | entry.BGeHYrTB `L()`/`I` | ADAPT (our auth routes differ; the mechanism and param name KEEP) | no | N-A |
| B12 | iOS `touchmove` pinch-block (`e.scale !== 1 && e.preventDefault()`) | entry.BGeHYrTB tail | KEEP-EXACT (trivial) | no | N-A |
| B13 | postindex/IndexedDB conditional install (`i.isEnabled(i.postindexStore)` → lazy `indexeddb` + `dist` chunks) | entry.BGeHYrTB | GAP pending T3/store tier (flag-gated store infrastructure; R-SEAM flag census adjacency) | — | OURS |

## 2. The prototype-extension kernel (ambient standard library)

`b()` installs, in order:

- **Array.prototype**: `distinct` (length ≤ 15 → `indexOf`-filter, else
  `[...new Set(this)]` — the 15-element fork is a pinned value), `concrete`
  (`filter(e => e !== void 0)`), `groupBy` (Map-based; optional second arg
  sorts keys via `sortBy` then rebuilds insertion order), `orderBy`/`sortBy`
  (delegate to the bundled lodash orderBy/sortBy chunks), `count`, `at`
  (polyfill), `toReversed` (polyfill).
- **String.prototype**: `capitalize`, `deCapitalize`, `toQuestion` (strip one
  trailing `.|,|:`, append `?` unless already last char).
- **Set.prototype**: `isEqualTo` (size equal + every-has), `difference`
  (polyfill).
- **Promise**: `raceFind(promises, predicate?)` — resolves with the first
  resolved value passing the predicate; resolves `undefined` when all settle
  without a pass; rejects on first rejection. `withResolvers` (polyfill).
- `Object.hasOwn` polyfill; `Symbol.dispose`/`Symbol.asyncDispose` defined as
  `Symbol('@linear/Symbol.dispose')` etc.
- **The date half (the 16:40Z review's find, settled 2×): `b()`'s second call
  `t()` is `core.PJIFv7xf.js`'s `fe` export** (html imports `$ as t`; core
  exports `fe as $`; `fe` = core L297–344 — html.CjyPLfH8 is the ONLY chunk
  in all 1,550 importing `$`, so this is boot-only installation, invisible to
  a consumer-side census). `fe` installs **`Date.prototype` (11 methods)**:
  `beginningOfWeek`, `nextWeekDay`, `midnight`, `nearestMidnight` (no-tz fork
  = `offsetByHours(12).midnight()`), `offsetByDays`, `offsetByBusinessDays`,
  `offsetByHours`, `offsetBySeconds`, `toUTCDate`, `daysTo`, `toTimelessDate`
  (`YYYY-MM-DD`, padStart) — each with a spacetime-backed tz branch (zone
  arg) vs plain-Date branch: two genuinely different date arithmetics per
  method — plus **`String.prototype.toLocalDate`**: UTC-field reconstruction;
  tz branch via spacetime; and the invalid-date self-recursion
  (`this.substring(0, this.length - 1).toLocalDate()`, stripping trailing
  chars until the string parses; empty → `new Date`). Demand (pretty tree):
  `toLocalDate` ~200 uses / ~25 files; `toTimelessDate` ~100 / ~15.
  **Interlock for R-SCHED (SCHED-1): the schedule kernel's recurrence math
  executes ON these ambient methods (`toTimelessDate` 5× / `midnight` 2× /
  `toLocalDate` 3× inside the kernel region, and the 12:46Z picker's weekday
  seed is `e.toLocalDate('UTC').getUTCDay()`) — ship the date kernel with or
  before SCHED-1's goldens, or they run against different date semantics and
  pass/fail silently wrong.** Value facts its golden must pin:
  `offsetByDays` ≠ `offsetByHours(24)` across DST boundaries (setDate vs
  epoch-ms), and the `toLocalDate` recursion's exact strip order.

Why load-bearing: **transcribed chunks call these as if they were the
language.** Measured consumer counts (pretty tree): `Issue.DRYymPCa.js`
`.concrete(` 99× / `.distinct(` 29× / `.orderBy(` 15×; `ContextualMenuActions`
272× / 66× / 28× + `.sortBy(` 36×; loops-family direct 3× `.concrete` +
1× `.count`. Settled thread facts already lean on them without naming the
definition site: the 00:54:08Z `sortByUserSortOrder` kernel, the memories
`orderBy(createdAt desc)` tiebreak, the G34 golden's `orderBy('name')`.

| Row | Disposition | Golden-req | Notes |
|---|---|---|---|
| prototype-extension module (all of the above, one module) | KEEP-EXACT | **yes (b)** — pure, zero-dep, value-laden forks (`distinct`'s 15-element split, `toQuestion`'s regex, `groupBy`'s sorted-key path, `raceFind`'s all-settle-undefined contract). G7-lineage drive-mode material, executable today | Ships in the FIRST A1 batch, before the primitive tier. Ambient-seam class for R-SEAM: imported by nobody, assumed by everybody — invisible to an import census |

## 3. The config seam (two chunks, one contract)

- `config.aM1_XCHx.js` (655 B): throwing Proxy + `injectConfig` setter.
  Uninjected read throws
  `` `Config has not been injected. Call injectConfig() during client initialization.` ``.
  **50 importer chunks.**
- `config.Uz-QjVze.js` (11.1 KB): the CONFIG table over
  `window.CLIENT_ENV` — **82 accessor keys: 64 required `n()` / 18 optional
  `r()`** (measured mechanically, regex `[nr](\`KEY\`)` deduped; the
  optional set is {ASSET_URL, CACHE_BUST, COUNTRY_CODE,
  DEBUG_LOG_EXPAND_BATCH_LOAD, DEBUG_LOG_NETWORK_DATA, DEV_BRANCH,
  ENABLE_CRASH_REPORTING, IS_PRODUCTION_RUNTIME, LINCTL_CONTROL_PLANE_URL,
  OAUTH_CLIENT_URL, POSTHOG_SESSION_REPLAY_WRITE_KEY, PREVIEW_BUILD,
  PREVIEW_BUILD_REVISION, PREVIEW_FEATURE_FLAGS, PREVIEW_PR_NUMBER,
  SENTRY_DIST, SENTRY_DSN, SENTRY_TUNNEL}), plus non-accessor derived
  properties (`__RELEASE_INFO`: BUILD_REVISION/DEPLOYED_AT/SHORT_SHA/
  PR_NUMBER, FLAG_CLIENT, CLIENT_HOSTNAME, IS_*_BUILD…) — "~90 keys" is
  reachable only by counting those too. Baked production fallback: **74
  distinct `VITE_*` literals** (client-api/sync/uploads/static URLs, every
  OAuth client id, Sentry DSN/tunnel, PostHog keys, Stripe, Turnstile,
  VAPID…). **85 importer chunks.** Accessor semantics are pinned facts:
  `n(key)` = required (missing ⇒
  `console.error("Environment variable ${key} is not defined")` + `''`),
  `r(key)` = optional (missing ⇒ `undefined`). Plus `PREVIEW_PR_NUMBER`'s
  host-regex fallback (`/pr-(\d+)/`).

Consumer census (regex `X.KEY` over the pretty tree — candidate ceiling):
`CLIENT_URL` 40 · `API_SERVER_URL` 29 · `OAUTH_CLIENT_URL` 9 ·
`ASKS_WEB_FORMS_URL` 7 · `GRAPHQL_SERVER_HTTP` 4 · `SENTRY_DSN` 3 ·
`STRIPE_PUBLIC_KEY` 3 · rest ≤ 2. Loops-family direct importers:
`AutomationPage`, `AutomationNewButton` (the closure reaches the seam through
the 50/85 importer sets — A1 batch, not tail).

**The parallel-to-Linear finding**: `window.CLIENT_ENV` wins over the baked
fallback, so OUR server serves its own CLIENT_ENV
(`API_SERVER_URL`/`GRAPHQL_SERVER_HTTP`/`SOCKET_SERVER_URL` = our server,
`ASSET_URL` = our static route, `CLIENT_URL` = our origin) and the exact UI
points at our endpoints through the corpus's own indirection — no seam
invention, no owner-licensed change. Config-plane sibling of the style plane's
ThemeProvider-injection finding (#295 14:38Z).

| Row | Disposition | Golden-req | Data plane |
|---|---|---|---|
| throwing-proxy + `injectConfig` contract | KEEP-EXACT | yes (b),(c) — the throw copy is a reachable degraded state | N-A |
| 82-accessor-key table (64 `n()` / 18 `r()`) + `__RELEASE_INFO` derived block | KEEP-EXACT (transcription-rule DATA: key names + accessor kind per key) | yes (b) — one golden pins the key surface and the n/r fork | N-A |
| the VALUES our deployment injects | NEW — "CLIENT_ENV injection endpoint" server row (our analog of first-party's index.html script). R-SRV adjacency | no (spec-ratified) | OURS |
| required-key coverage leg | NEW (tools/coverage): the set of `n()`-accessed keys demanded by the widened-scope closure is GENERATED, never hand-listed (00:56Z rule) — a deploy missing one fails loudly in CI, not silently at `console.error` | — | N-A |

## 4. Telemetry rows (OUT through the corpus's own gates)

Sentry init (`Logger.qFaEBF6-.js` ~L11961): dsn/tunnel from CONFIG, release =
`semanticVersionString({packageName:'linear', buildRevision, previewPrNumber})`,
ignoreErrors + ignoreSpans (`/sentry/i, /\/envelope\/?$/i, /posthog/i,
/datadog/i`), tracePropagationTargets over API/GraphQL/tunnel ORIGINS,
tracesSampler reading the `sentryTracingRate` flag, `allowUrls:
['linear.app']`, `normalizeDepth: 6`, flushAtStartup transport. Profiling:
`if (!SENTRY_DSN) return false`.

**Every gate hangs on optional (`r()`) keys.** Leave `SENTRY_DSN`,
`SENTRY_TUNNEL`, `POSTHOG_WRITE_KEY` unset in our CLIENT_ENV and the telemetry
plane self-disables through corpus-testified code paths — the cheapest OUT in
the ledger: no seam, no fork.

| Row | Disposition | Notes |
|---|---|---|
| Sentry init + samplers + scrubbing | OUT (unset-key self-disable) | The init code itself transcribes as-is; it no-ops |
| PostHog (`ph_${POSTHOG_WRITE_KEY}_posthog` localStorage key, 2 RefreshManager sites) | OUT (same rule) | |
| `ANALYTICS_URL` event sink (`https://e.linear.app`) | OUT | Zero consumers outside the config table in the pretty tree; the analytics REASON vocabulary is separately KEPT as our audit enum (#295 02:18Z, R-SRV) — undisturbed by this OUT |
| `_sentryDebugIds` per-chunk preamble (all 1,550 chunks) | KEEP-EXACT (it is exact structure, already inside every golden's byte-match) | The runtime upload path it feeds is OUT via the rows above |

## 5. Service worker (ADAPT + honest GAP)

`entry` registers `/client/sw.js?${SW_HASH}` (scope `/`, type `module`);
**Firefox instead UNREGISTERS all registrations** (pinned browser fork);
skipped on the §1 B11 route list. Init message carries
`disableServiceWorkerCaching` from settings; a `prefetch` message ships
`ASSET_URL` on `onStartLowPriorityTasks`; a MessageChannel routes sw log
messages into Logger by type (`error`/`warning`/`debug`, unknown ⇒
UnreachableCaseError path). Push-notification registration hangs off the SW
registration object. Registration failure → info log
`Service worker registration failed` + undefined registration — so a no-SW
deployment degrades through corpus-testified code.

| Row | Disposition | Golden-req |
|---|---|---|
| SW registration + message protocol + Firefox fork | ADAPT (serve assets with ordinary cache headers; register no SW initially) | no |
| `sw.js` INTERNALS (caching strategy) | **GAP — not in the corpus** (pipeline BFS walks Vite asset refs; sw is a string URL). Pipeline follow-up: add `client/sw.js` to the fetch set (same-origin static, versioned by SW_HASH) | — |

## 6. The missing index.html + desktop shell rows

`corpus/app/asar-src/out/renderer/index.html` is **0 bytes at `c44f2cf`**
(committed empty at the original corpus drop `5abaca6` — an extraction
artifact, not a real empty file). The web index.html is not fetched at all.
That file is the definition site for `window.CLIENT_ENV`,
`window.__RELEASE_INFO`, `window.__showLoadingError`,
`window.__clearEntryLoadTimeout`, the entry-load timeout, and the pre-React
loading shell — all referenced-but-undefined in the chunk tree (zero
definition sites in all 1,550, verified). `html.CjyPLfH8.js` is the compiled
module twin of the html's script, so §1–§3 stand on chunk evidence; the
loading shell's exact markup/copy (first paint before React) is unverifiable
today.

| Row | Disposition | Notes |
|---|---|---|
| pre-React loading shell (markup, copy, timeout, `__showLoadingError` grammar) | **GAP** pending pipeline fix. Reference meanwhile: `error.html` (present, 3.9 KB: full markup, inline CSS, font stack, `#090909` background) | Pipeline follow-up: fetch the live web index.html at pipeline run + re-extract the asar renderer html |
| DesktopServer loopback (`app/asar-src/out/main/server.js`: ports `[44450,18450,33234]`, `/linear/check-url` + `/linear/open-url`, origin allow-list `['https://linear.app','https://local.linear.dev:8080']`) | OUT — desktop-app plumbing; our product is web-self-hosted | |

## Interlocks

- **R-FACADE / A1**: B2 (§2) and B3+B4 (§3) land in or before A1's first
  assembly slice — every transcribed chunk assumes them at module eval.
- **R-STYLE**: `__toStaticUrl`/`ASSET_URL` is how the stylesheet and the
  3-family `@font-face` set resolve (fonts live on `static.linear.app` ⇒ our
  ASSET_URL re-host carries them). B9's `layoutScrollbarObtrusive` body class
  is a stylesheet consumer.
- **R-SEAM**: §2 joins the platform list as the ambient-seam class; the config
  proxy (§3) joins as an ordinary seam; B13's postindex flag joins the flag
  census.
- **R-SRV**: the CLIENT_ENV injection endpoint row (§3) and the no-SW asset
  cache-header row (§5).
