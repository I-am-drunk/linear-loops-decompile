# Type-checking this package

`tsconfig.json` runs `strict` but **omits `exactOptionalPropertyTypes` and
`noUncheckedIndexedAccess`**, which the repo otherwise expects. This file is
why, and what it would take to remove the exception.

## The constraint

`theme-css.ts` imports `../ui-theme/generate-theme.ts`. TypeScript applies the
**root** config to every file it reaches, so those two options get applied to
`ui-theme` as well — producing **125 errors** (74 in `color.ts`, 51 in
`generate-theme.ts`) in a package that passes its own gate, which omits them.

`ci/check-src.sh` checks every `src/*/tsconfig.json` **and does reach this
one**, so the errors fail CI. (An earlier revision of this file claimed the
gate did not reach it. That was wrong — CI proved it on PR #320.)

Precedent: `src/ui-loops-template-launcher` also imports `../ui-theme` and also
omits both options. This package matches it rather than inventing a third
convention.

## Workarounds that do not work

Recorded so nobody spends the time again:

| Attempt | Why it fails |
|---|---|
| `@ts-expect-error` on the import | cannot suppress errors raised *inside* an imported file |
| `exclude: ["../ui-theme/**"]` | `exclude` does not apply to files reached by import |
| `paths` redirection to a stub | did not displace the real relative module |
| ambient `declare module "../ui-theme/…"` | a relative specifier resolves to the real file, which wins |
| committing generated `.d.ts` | build output is not source; it drifts silently |

## What our code actually holds to

Our seven modules are clean under the **full** set, both options included:

```bash
cd src/ui
npx tsc --noEmit -p tsconfig.json --exactOptionalPropertyTypes --noUncheckedIndexedAccess \
  2>&1 | grep -v '^\.\./ui-theme' | grep -v '^\s'
# (silent)
```

And `build.sh` enforces both for real, because the browser build's three input
modules (`client`, `shell`, `routes`) do not import `ui-theme` — the theme
renders server-side.

## Removing the exception

Make `src/ui-theme` clean under both options, then add them here and delete
this file. That is its own PR: `ui-theme` is golden-backed, and 125 type
changes must not perturb its goldens. It is a good slice for someone — the
errors are the mechanical `Record<string, string>` indexing and tuple-access
kind, not design problems.
