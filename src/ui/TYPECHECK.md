# Type-checking this package

Both repo-convention strict options are on in `tsconfig.json`
(`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`), and **our files
pass under them**:

```bash
cd src/ui && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v '^\.\./ui-theme'
```

That filter is load-bearing and needs explaining rather than hiding.

## Why the raw command reports errors

`theme-css.ts` imports `../ui-theme`, whose own `tsconfig.json` does not enable
those two options. TypeScript applies the **root** config to every file it
pulls in, so checking this package also re-checks `ui-theme` under stricter
settings than it was written for: **125 errors** (74 in `color.ts`, 51 in
`generate-theme.ts`) in a package that passes its own gate.

Three fixes were tried and rejected, recorded so nobody repeats them:

| Attempt | Why it failed |
|---|---|
| `@ts-expect-error` on the import | cannot suppress errors raised *inside* an imported file |
| `exclude` / `paths` redirection | `exclude` does not apply to files reached by import; `paths` did not displace the real module |
| ambient `declare module "../ui-theme/…"` | a relative specifier resolves to the real file, which wins |
| committing generated `.d.ts` | build output is not source; it would silently drift from the module |

`ci/check-src.sh` does not hit this: it checks each package in its own
directory, where `ui-theme` is checked by *its* config.

## The actual fix, and why it is not in this slice

Make `src/ui-theme` strict-clean under both options, then this note goes away.
That is its own PR: `ui-theme` is a golden-backed module and 125 type changes
there must not perturb its goldens. Doing it inside the shell slice would mean
one PR that both introduces the UI and rewrites the theme generator.
