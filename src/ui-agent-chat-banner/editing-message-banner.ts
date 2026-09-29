/**
 * EditingMessageBanner — clean reimplementation of the corpus chunk
 * `useHydrateAgentConversations.DJ4Hg1po.js` export `n` (matrix §D
 * "Conversation list/hydration" row; the "Editing message" banner shown above
 * the agent input while a message edit is being composed). Original code;
 * every value below is verified byte-for-byte against the committed
 * corpus-executed golden (`golden/editing-message-banner.expected.json`) —
 * see `corpus-manifest.json` and the golden test.
 *
 * The corpus component is `div(8-class stylex row) > [EditIcon(size:12,
 * color:labelMuted), Text(variant:mini, color:labelMuted, 'Editing
 * message')]`. The golden's observation is the flattened host tree with the
 * corpus Text executed (hook-free) and the icon seam held as a declared
 * marker, so this module mirrors that boundary: it takes the icon component
 * as an argument (the icon lives in its own chunk and is its own ledger
 * surface) and emits the Text host output directly — same tags, same prop
 * KEY ORDER, same merged stylex class strings, same `--x-4xs81a` var resolved
 * through ThemeProvider's static labelMuted entry. The class strings are
 * pinned facts: each fragment is a source literal (the entry's own 8-class
 * row; Text `p.text`/variant-mini/textColor/`m.left`), verified via the
 * golden bytes.
 *
 * Zero runtime deps: elements carry the standard registered React element
 * symbol (G4 precedent), so the tree is indistinguishable as a VALUE from the
 * corpus output and the golden byte oracle applies.
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

/** The entry's own row classes (source literal, 8 classes). */
const ROW_CLASS = `sx-78zum5 sx-6s0dn4 sx-17d4w8g sx-euugli sx-1iorvi4 sx-mzs88n sx-jkvuk6 sx-163pfp`;

/** Corpus Text output for variant:mini color:labelMuted (align default left). */
const TEXT_CLASS = `sx-1j61x8r sx-ggjnk3 sx-167xe44 sx-1nzvdvg sx-ek0tjz sx-13jp3wb sx-3d248p sx-1wuuqhr sx-dpxx8g sc2sx-Text-c50a30fa`;

/** ThemeProvider's static CSS-var for labelMuted, fed to Text's color var. */
const LABEL_MUTED_VAR = `var(--sx-1dd5bcf)`;

/** The edit-icon seam: its own chunk (ContextualMenuActions rL), passed in. */
export function EditingMessageBanner(EditIcon: unknown): HostElement {
  return h(`div`, {
    className: ROW_CLASS,
    children: [
      h(EditIcon, { size: 12, color: `labelMuted` }),
      h(`span`, {
        ref: undefined,
        className: TEXT_CLASS,
        style: { "--x-4xs81a": LABEL_MUTED_VAR },
        children: `Editing message`,
      }),
    ],
  });
}
