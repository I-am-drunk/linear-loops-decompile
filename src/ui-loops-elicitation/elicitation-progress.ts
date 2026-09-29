/**
 * ElicitationProgress — clean reimplementation of the corpus chunk
 * `AgentElicitationResponseQueue.BM8OrYyq.js` export `t` (matrix §D
 * "Elicitations" row; the status line shown in the agent chat while
 * elicitation questions are being answered). Original code; every value below
 * is verified byte-for-byte against the committed corpus-executed golden
 * (`golden/elicitation-progress.states.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus component is `Flex(align:center, grow:1, noMinWidth, sx) > div
 * [aria-live=polite] > Text(variant:small, color:labelFaint)`, with the label
 * `` `${answeredCount} of ${elicitationCount} answered` `` or
 * `Submitting answers…` while `isSubmitting`. The golden's observation is the
 * FULLY FLATTENED host tree (the corpus Flex/Text composites executed, being
 * hook-free), so this module returns that host tree directly: same tags, same
 * prop KEY ORDER (ref, className, style, children — the order Flex/Text emit),
 * same merged stylex class strings, same `--x-4xs81a` color CSS var resolved
 * through ThemeProvider's static labelFaint var. The class strings are pinned
 * facts, not styling choices: each fragment is a source literal
 * (Flex `l.flex`/`flexDefault`/`center`/`flexNoMinWidth`/`u[1]`, the entry's
 * own sx table, Text `p.text`/variant-small/textColor/`m.left`) and the merge
 * order is the corpus stylex merge, all verified via the golden bytes.
 *
 * Zero runtime deps: elements carry the standard registered React element
 * symbol (`Symbol.for("react.transitional.element")` — what the corpus's own
 * jsx-runtime emits on React 19), so the tree is indistinguishable as a VALUE
 * from the corpus output and the golden byte oracle applies (G4 precedent).
 */

const ELEMENT: unique symbol = Symbol.for(`react.transitional.element`) as never;

export interface HostElement {
  $$typeof: typeof ELEMENT;
  type: string;
  key: null;
  props: Record<string, unknown>;
}

function h(type: string, props: Record<string, unknown>): HostElement {
  return { $$typeof: ELEMENT, type, key: null, props };
}

/** Corpus Flex output for align:center grow:1 noMinWidth + the entry's sx. */
const FLEX_CLASS = `sx-78zum5 sx-vx4679 sx-1q0g3np sx-6s0dn4 sx-euugli sx-1iyjqo2 sx-h8yej3 sx-1lqa7cf sx-y13l1i sc2sx-Flex-d11c8f6e`;

/** Corpus Text output for variant:small color:labelFaint (align default left). */
const TEXT_CLASS = `sx-1j61x8r sx-ggjnk3 sx-oxd7ts sx-1nzvdvg sx-ek0tjz sx-13jp3wb sx-3d248p sx-1wuuqhr sx-dpxx8g sc2sx-Text-c50a30fa`;

/** ThemeProvider's static CSS-var for labelFaint, fed to Text's color var. */
const LABEL_FAINT_VAR = `var(--sx-1eapsa9)`;

export interface ElicitationProgressProps {
  answeredCount: number;
  elicitationCount: number;
  isSubmitting: boolean;
}

export function ElicitationProgress(props: ElicitationProgressProps): HostElement {
  const { answeredCount, elicitationCount, isSubmitting } = props;
  return h(`div`, {
    ref: undefined,
    className: FLEX_CLASS,
    style: undefined,
    children: h(`div`, {
      "aria-live": `polite`,
      children: h(`span`, {
        ref: undefined,
        className: TEXT_CLASS,
        style: { "--x-4xs81a": LABEL_FAINT_VAR },
        children: isSubmitting ? `Submitting answers…` : `${answeredCount} of ${elicitationCount} answered`,
      }),
    }),
  });
}
