/**
 * TemplateCardPresenter — clean reimplementation of the corpus chunk
 * `useLoopTemplateLauncher.O9-_gagH.js` export `r` (chunk-local class `G`;
 * matrix §A "Template library + launcher" row): the template-card presenter
 * statics. Original code; the behavior is verified byte-for-byte against the
 * committed corpus-executed golden
 * (`golden/template-presenter.copy.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * Reproduced exactly from the corpus source:
 * - `triggerLabel`: the trigger-copy switch — schedule cadence Hourly/Daily/
 *   Weekly with `Unreachable case: ${cadence}` on an unknown cadence, issue
 *   events `On new issue` (entityCreated) / `On triage` (entityInTriage) /
 *   `On issue change` (any other event), and `Unreachable case: ${trigger}`
 *   on an unknown trigger type (the corpus throws the whole trigger object,
 *   which stringifies as `[object Object]` — pinned);
 * - `iconColor`: `toCss("RGB", fromCss(theme.color[template.color]))`,
 *   composed from OUR golden-backed `src/ui-theme` color math (the
 *   reimplementation composes like the corpus composes; provenance chains to
 *   the H2 goldens) — including the corpus `fromCss` fallback to `[0,0,0]`
 *   (black) for a CSS format outside its hex/lch/p3 grammar.
 */

import { fromCss, toCss } from "../ui-theme/color.ts";

/** The corpus UnreachableCaseError message shape (an Error subclass). */
class UnreachableCaseError extends Error {
  constructor(value: unknown) {
    super(`Unreachable case: ${value}`);
  }
}

export type TemplateTrigger =
  | { type: `schedule`; cadence: `hourly` | `daily` | `weekly` }
  | { type: `issue`; event: string };

export interface TemplateLike {
  trigger: TemplateTrigger;
}

export const TemplateCardPresenter = {
  /** Corpus `G.iconColor(template, theme)`. */
  iconColor(template: { color: string }, theme: { color: Record<string, string> }): string {
    return toCss(`RGB`, fromCss(theme.color[template.color] as string));
  },

  /** Corpus `G.triggerLabel(template)` — the card's trigger copy. */
  triggerLabel(template: TemplateLike): string {
    const trigger = template.trigger;
    switch (trigger.type) {
      case `schedule`: {
        const cadence = trigger.cadence;
        switch (cadence) {
          case `hourly`:
            return `Hourly`;
          case `daily`:
            return `Daily`;
          case `weekly`:
            return `Weekly`;
          default:
            throw new UnreachableCaseError(cadence);
        }
      }
      case `issue`:
        return trigger.event === `entityCreated`
          ? `On new issue`
          : trigger.event === `entityInTriage`
            ? `On triage`
            : `On issue change`;
      default:
        throw new UnreachableCaseError(trigger);
    }
  },
};
