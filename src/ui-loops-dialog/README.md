# ui-loops-dialog — matrix §A "New-loop dialog + button" (G10)

The reference oracle for this surface is computed by EXECUTING the corpus
chunk offline (SPECS/ui-parity.md, golden tier; tools/corpus-exec) and
hand-verifying every output region against the corpus source. The clean
reimplementation (`automation-new-dialog.ts`) byte-matches
`golden/*.expected.json` through the tagged-v2 serializer (the declared
observation driver).

## What this golden adds to the pattern library

- **The derived-theme seam.** This is the first golden through
  `useTheme().baseTheme ?? theme` → `.elevatedTheme()`: the corpus derives an
  ELEVATED theme and provides it to a nested ThemeProvider. The stub pins
  identify the H2 corpus-executed elevated derived themes
  (`src/ui-theme/golden/golden-derived-retina0.json`
  `.darkDefault/.lightDefault.derived.elevated` — provenance chains across
  goldens, nothing invented), and the elevatedTheme() RESULT lands verbatim
  in the observed output, proving the derivation is routed, not re-read.
- **Both derivation branches pinned by the pair.** darkDefault's stub has NO
  `baseTheme` (pins the `?? theme` fallback); lightDefault's stub carries
  `elevatedTheme` ONLY on `baseTheme` (a reimplementation deriving from the
  root would throw, never silently pass). Unpinned member reads THROW
  (proxy stubs, the G4 discipline).
- **Component seams as string markers.** Modal (`ContextualMenuActions.eL`,
  full chunk name pinned — the corpus carries a hash-rotated re-export twin),
  IconButton, CloseIcon, and LoopTemplateLibrary are separate ledger rows;
  their stub markers keep the observed tree host-tier while the props the
  entry passes them (isOpen/zIndex/aria-labels/sx/variant) stay in the byte
  oracle.
- Invoke-tier: with useTheme stubbed to plain data the component is
  hook-free (the merged G4 finding) — plain invocation observes the tree.

## Hand-verification record (2026-09-28, the committed golden pair)

Verified region-by-region against `AutomationNewDialog.Wu-wKkiY.js` (raw,
vault `c5ae1ba`):

- Modal props: `isOpen:!0` → true, `onRequestClose:u` → the routed prop pin,
  `zIndex:\`default\`` — verbatim, source order.
- ThemeProvider `theme`: the stub's elevatedTheme() result object, proving
  `(d.baseTheme ?? d).elevatedTheme()` — both branches (pair).
- dialog div: `role`, `aria-modal:"true"`, `aria-label:"Create a new loop"`,
  and the 11-class `className` string byte-match the source template
  literals, in source prop order.
- IconButton: `aria-label:"Close modal dialog"`, `onClick:u` (same routed
  pin as Modal.onRequestClose — the output shows both carry the identical
  pin string), `sx` = the source's `l.closeButton` table verbatim
  (kVAEAm/k87sOh/kCIrl2/$$css, source key order), CloseIcon child, no props.
- body div: `className:"sx-2lwn1j sx-1odjw0f sx-ggk2y7"` verbatim;
  LoopTemplateLibrary props `parent` (routed pin) + `variant:"modal"`.
- Re-execution is byte-identical, including under TZ=Asia/Tokyo +
  LANG=tr_TR.UTF-8 (ambient-invariant, per the #225 ambient policy).

Verify: `node --experimental-strip-types tools/corpus-exec/main.ts verify
src/ui-loops-dialog/golden/automation-new-dialog.darkDefault.json`
(and the lightDefault sibling; needs the vault corpus at `pipeline/corpus`).
