# src/ui — the app shell (SH1)

The shell every surface mounts into. Zero runtime dependencies, plain DOM.

| File | What |
|---|---|
| `routes.ts` | the route table as DATA, plus the hash router |
| `shell.ts` | sidebar + content frame; `registerSurface` is how a lane claims a route |
| `theme-css.ts` | `src/ui-theme` tokens -> `--t-*` CSS custom properties |
| `shell.css.ts` | the stylesheet; every colour is a token, no literals |
| `index-html.ts` | the served document, built per request |
| `client.ts` | browser entry |
| `fake-dom.ts` | a DOM small enough to test against, no dependency |
| `build.sh` | `tsc` -> plain ESM into a static dir |

## Adding a surface

Add a row to `ROUTES`, then from your lane's module:

```ts
registerSurface("automations", (slot, route) => { /* render into slot */ });
```

Until a route is claimed it shows a placeholder naming the slice that owes it,
so the nav never lies about what exists.

## Conventions worth keeping

- **Routes are data.** The nav renders from the table; adding a surface never
  edits the shell.
- **No component hardcodes a colour.** `shell.css.ts` uses `--t-*` only, and a
  test fails on any hex or `rgb()` in it.
- **Hash routing**, because the app is reached through tunnels and mount paths
  where history routing needs server cooperation.
- **No bundler.** `build.sh` runs `tsc` and the browser loads the module graph,
  which is why imports stay extension-qualified.

## Running it

```bash
bash src/ui/build.sh ../server/static   # emit the client bundle
node --experimental-strip-types src/server/start.ts
```

`?theme=lightDefault` switches preset without a rebuild (`darkDefault`,
`darkHighContrast`, `lightDefault`, `lightHighContrast`).

Needs a Node with `node:sqlite` (24.x, or 22.5+); the gate's type stripping
needs 22+.
