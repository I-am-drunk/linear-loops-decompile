# Status

As of 2026-10-07, the delivery target is **one working automation**, followed by
whole-Linear UI coverage. Read PLAN.md for order and the live board for work:

```sh
node tools/board/main.mjs --feedback
```

| Area | Evidence-backed state |
|---|---|
| Main | Server/transport, model, theme and presentation kernels exist |
| Product UI | Settings frame, row primitives and a partial Cursor desktop list are available; no composed app is delivered on main |
| Execution | Persistence, scheduler, executor and UI wiring need explicit slices |
| Inference | Text-only provider contract, fallback registry and OpenAI-compatible adapter; additional adapters await review |
| Exactness | #327 merged: required declaration checks run in CI; actual reference comparisons remain necessary |
| T3 Code Connect | Existing adapter is a prototype over our protocol; interoperability is unverified |
| Linear | Public-API client exists; sign-in and integration packages await wiring and verification |
| Cursor | Version-pinned desktop list facts exist in the sibling repo; authenticated layout capture remains unverified |

A PR, package or green mock test is not a delivered user flow. Update this file
when a merged slice changes these statements; do not copy a static PR queue here.

History and outstanding risks: docs/LEARNINGS.md and docs/history/issues.md.
