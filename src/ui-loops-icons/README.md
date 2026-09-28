# ui-loops-icons — matrix §A "Empty states" (G4: the first rendered-component golden)

The reference oracle for this surface is computed by EXECUTING the corpus
component offline (SPECS/ui-parity.md, golden tier; tools/corpus-exec) and
hand-verifying every output region against the corpus source. The clean
reimplementation of this package byte-matches `golden/*.expected.json` when it
lands; until then the goldens ARE the acceptance bar for it.

## The pattern (what every rendered-component slice copies)

- `golden/<case>.json` — the case file. Entry chunk by prefix; stubs are
  hand-written original ESM with a `why`, values pinned FROM other goldens
  (here: the three theme tokens from the H2 corpus-executed darkDefault
  golden — provenance chains, nothing is invented).
- The stubbed `useTheme` returns plain data, which makes this component
  hook-free, so `invoke` mode observes the returned host-element tree
  directly on the corpus's own jsx-runtime; no dispatcher needed. A component
  with real hook state uses `render` mode (`render.reactChunk`).
- Unpinned theme-token reads THROW (proxy stub): extending the component
  never silently reuses a stale pin.
- `golden/<case>.expected.json` — serializer v2 tagged bytes + provenance
  (corpus head, raw source flavor, chunk hashes, serializer version).

## Hand-verification record (2026-09-28, the committed golden)

Verified against `AgentAutomationEmptyStateIcon.BW9M5hMw.js` (raw, vault
`c5ae1ba`): svg viewBox/width/height/className/fill are the source's template
literals verbatim; all 3 path `d` attributes byte-match the 3 source
`d:`-literals; the 3 `fill` values are exactly `t.color.{labelMuted,labelBase,
labelFaint}` resolved through the H2 darkDefault golden (#215/#223 lineage).
Re-execution is byte-identical, including under TZ=Asia/Tokyo +
LANG=tr_TR.UTF-8 (ambient-invariant, per the #225 ambient policy).

Verify: `node --experimental-strip-types tools/corpus-exec/main.ts verify
src/ui-loops-icons/golden/agent-automation-empty-state-icon.darkDefault.json`
(needs the vault corpus at `pipeline/corpus`).
