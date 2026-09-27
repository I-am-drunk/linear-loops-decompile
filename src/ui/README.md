# src/ui — app shell, router, dark theme (T-801) + settings (T-802)

v0.0.2 adds the Settings feature: connect Linear (PAT verify), connect inference
(harness CRUD, probe, test), environment page. Pages are presentational with
intent callbacks; the registry wires them to fixtures until R9's channel lands.

The frame the whole web UI lives in. Loops-only sidebar, hash router, dark theme,
page registry. React 19 + Vite, zero runtime deps beyond React.

## Commands

- `npm install` then `npm run dev` — local dev server (Vite, port 5173)
- `npm run build` — production bundle in `dist/` (the loops-server serves this statically)
- `npm run typecheck` — `tsc --noEmit` (strict + exactOptionalPropertyTypes + verbatimModuleSyntax)
- `npm test` — router unit tests (node:test, type-stripped) + SSR smoke (esbuild + renderToString)

## Map

| Path | What |
|---|---|
| `src/router.ts` | Pure route table: parseHash / routeToPath / nav sections. No React, no DOM. |
| `src/useHashRoute.ts` | React binding (`useHashRoute`, `navigate`, `href`). Hash = history. |
| `src/theme.css` | Dark theme tokens + shell layout + shared classes (`.btn`, `.status-dot`, …). |
| `src/shell/AppShell.tsx` | Sidebar + topbar (title, breadcrumbs) + content outlet. Presentational. |
| `src/shell/Sidebar.tsx` | Loops-only nav: Loops / Runs / Templates, Settings footer + env status dot. |
| `src/shell/icons.tsx` | Hand-drawn 16×16 stroke icons, `currentColor`. No icon dependency. |
| `src/pages/registry.tsx` | **Registry-as-data**: route → page component + topbar title. Feature pages replace placeholder entries HERE; the shell never changes. |
| `src/features/settings/` | T-802: SettingsHome / ConnectLinear / ConnectInference / Environment pages, fixtures, `--ll`-free styling (shell tokens via `SettingsStyles`). |
| `src/pages/Placeholders.tsx` | Self-describing placeholders (name the owning task). |

## Contracts for feature owners

- **R7 (T-701/702/703)**: write presentational pages (props in/out, no direct network).
  Register them in `registry.tsx`. Theme tokens to lift: `--bg`, `--bg-raised`,
  `--border`, `--text`, `--text-muted`, `--accent`, `--success/warning/danger`;
  classes `.btn`, `.btn.primary`, `.placeholder`. Sidebar already lights up for
  your routes via `navSectionOf`.
- **T-802 (done)**: settings pages are live in the registry, wired to fixtures.
  The container swap when R9 lands: replace the fixture props in `registry.tsx`
  with connect-RPC-backed containers; pages and intents don't change.
- **R9**: a container component above `<App/>` should provide `workspaceName` and
  `envStatus` (from `env.describe()` + socket state) — both are already props.
  Runs "live" pages subscribe via the R9 channel and feed props to T-703's page.
- **server**: serves `dist/` statically; deep links are all `#/...` so no SPA
  fallback rules are needed.

## Design notes

- Hash routing (not history API): self-hosted single-page app served by our own
  Node server — hashes need zero server route config and survive file:// opens.
- "Runs" nav item currently targets `/loop/all/runs` as an aggregate view;
  T-703 may replace it with a dedicated `/runs` route — one line in `router.ts`
  + one registry entry.
- Env status dot lives on the Settings footer item (loops-only sidebar keeps the
  transport status one click away, never in the way).

