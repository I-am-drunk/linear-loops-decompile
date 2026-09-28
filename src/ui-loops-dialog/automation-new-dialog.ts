/**
 * AutomationNewDialog — clean reimplementation of the corpus chunk
 * `AutomationNewDialog.Wu-wKkiY.js` export `AutomationNewDialog` (matrix §A
 * "New-loop dialog + button" row). Original code; every value below is
 * verified byte-for-byte against the committed corpus-executed golden pair
 * (`golden/automation-new-dialog.{darkDefault,lightDefault}.expected.json`)
 * — see `corpus-manifest.json` and the golden test.
 *
 * The corpus component:
 *   1. reads the ambient theme (`useTheme()`), takes `theme.baseTheme ??
 *      theme`, and derives `elevatedTheme()` from THAT (both branches pinned
 *      by the golden pair — the dark case has no baseTheme, the light case
 *      puts elevatedTheme only on the baseTheme);
 *   2. renders Modal(isOpen:true, onRequestClose, zIndex:'default') >
 *      ThemeProvider(theme: elevated) > div[role=dialog, aria-modal,
 *      aria-label 'Create a new loop'] > [IconButton(CloseIcon, closeButton
 *      sx), div > LoopTemplateLibrary(parent, variant:'modal')].
 *
 * Like the G4/G5 icon modules, the context/registry seams are ARGUMENTS so
 * this stays a pure value function: the ambient theme comes in as a value,
 * and the four child components (Modal, ThemeProvider, IconButton wrapper's
 * CloseIcon, LoopTemplateLibrary) come in as a components registry — the
 * golden test passes the same string markers the corpus execution's declared
 * stubs used, so the byte oracle covers exactly the entry chunk's own tree.
 *
 * Zero runtime deps: elements use the standard registered React element
 * symbol (`Symbol.for("react.transitional.element")` — what the corpus's own
 * jsx-runtime emits on React 19), same prop KEY ORDER as the corpus jsx
 * calls, so the tree is indistinguishable as a VALUE from the corpus output.
 */

const ELEMENT: unique symbol = Symbol.for(`react.transitional.element`) as never;

export interface HostElement {
  $$typeof: typeof ELEMENT;
  type: unknown;
  key: null;
  props: Record<string, unknown>;
}

function h(type: unknown, props: Record<string, unknown>): HostElement {
  return { $$typeof: ELEMENT, type, key: null, props };
}

/** The theme surface this dialog reads (corpus: `useTheme().baseTheme ?? theme`,
 * then `.elevatedTheme()`). The elevated theme itself is opaque here — the
 * component only routes it. */
export interface DialogTheme {
  baseTheme?: { elevatedTheme(): unknown } | undefined;
  elevatedTheme?: () => unknown;
}

/** The four child-component seams (each is its own ledger row / future golden). */
export interface DialogComponents {
  Modal: unknown;
  ThemeProvider: unknown;
  IconButton: unknown;
  CloseIcon: unknown;
  LoopTemplateLibrary: unknown;
}

export interface AutomationNewDialogProps {
  parent: unknown;
  onRequestClose: unknown;
}

/** Corpus: `var l = { closeButton: {...} }` — the sx table, verbatim. */
const SX = {
  closeButton: {
    kVAEAm: `sx-10l6tqk`,
    k87sOh: `sx-omnu4r sx-bme5g0`,
    kCIrl2: `sx-n5hqff sx-krrm2v`,
    $$css: true,
  },
};

const DIALOG_CLASS = `sx-1n2onr6 sx-dpfuu1 sx-w7nakj sx-m7jadh sx-2lwn1j sx-78zum5 sx-dt5ytf sx-1lmytr0 sx-4pepcl sx-mhyh96 sx-b3r6kr`;
const BODY_CLASS = `sx-2lwn1j sx-1odjw0f sx-ggk2y7`;

export function AutomationNewDialog(
  theme: DialogTheme,
  c: DialogComponents,
  props: AutomationNewDialogProps,
): HostElement {
  const base = theme.baseTheme ?? theme;
  const elevated = (base as { elevatedTheme(): unknown }).elevatedTheme();
  return h(c.Modal, {
    isOpen: true,
    onRequestClose: props.onRequestClose,
    zIndex: `default`,
    children: h(c.ThemeProvider, {
      theme: elevated,
      children: h(`div`, {
        role: `dialog`,
        "aria-modal": `true`,
        "aria-label": `Create a new loop`,
        className: DIALOG_CLASS,
        children: [
          h(c.IconButton, {
            "aria-label": `Close modal dialog`,
            onClick: props.onRequestClose,
            sx: SX.closeButton,
            children: h(c.CloseIcon, {}),
          }),
          h(`div`, {
            className: BODY_CLASS,
            children: h(c.LoopTemplateLibrary, {
              parent: props.parent,
              variant: `modal`,
            }),
          }),
        ],
      }),
    }),
  });
}
