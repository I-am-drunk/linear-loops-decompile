/**
 * Prompts (AU4, docs/plan/automations.md).
 *
 * A prompt is either a single prompt or an ordered CHAIN of steps. Each step
 * has its own text and its own model, because the cheap model is right for
 * step one and the expensive one for step three. Later steps see earlier
 * output. Reorderable, with add and remove.
 *
 * This is the feature that makes per-automation model choice matter, and why
 * the inference registry (IN1) is a dependency rather than a nicety: the
 * model list on each step comes from it.
 *
 * Pure list operations plus the section AU2 renders. No execution — the
 * runner owns that — and no RPC.
 */

import type { Draft, SectionSpec } from "./detail.ts";
import type { Model } from "../inference/types.ts";
import type { Row } from "../ui-settings/rows.ts";

export type PromptStep = {
  id: string;
  text: string;
  /** A model id from the registry. Empty means "the automation's default". */
  model: string;
};

/** The draft key the Prompts section owns. */
export const PROMPTS_KEY = `prompts`;

/** Read the chain off a draft, tolerating a missing or malformed key. */
export function stepsOf(draft: Draft): PromptStep[] {
  const v = draft[PROMPTS_KEY];
  return Array.isArray(v) ? (v as PromptStep[]) : [];
}

export type ChainResult =
  | { ok: true; steps: PromptStep[] }
  | { ok: false; detail: string };

/**
 * Append a step. Returns a NEW list; the editor's set() does dirty tracking.
 * Blank text is refused: an empty step would send an empty prompt and burn a
 * call for nothing, which the runner should never be asked to do.
 */
export function addStep(steps: readonly PromptStep[], step: PromptStep): ChainResult {
  if (step.text.trim() === ``) return { ok: false, detail: `a step needs prompt text` };
  if (steps.some((s) => s.id === step.id)) return { ok: false, detail: `duplicate step id ${step.id}` };
  return { ok: true, steps: [...steps, step] };
}

export const removeStep = (steps: readonly PromptStep[], id: string): PromptStep[] =>
  steps.filter((s) => s.id !== id);

/**
 * Move a step to a new index. Pure; clamps the target so a drag past either
 * end lands at the end rather than throwing or silently dropping the step.
 * Order is meaning here — later steps see earlier output — so a reorder is a
 * real edit, and the editor's canonical comparison treats array order as
 * significant for exactly this reason.
 */
export function moveStep(steps: readonly PromptStep[], id: string, to: number): PromptStep[] {
  const from = steps.findIndex((s) => s.id === id);
  if (from === -1) return [...steps];
  const target = Math.max(0, Math.min(to, steps.length - 1));
  if (target === from) return [...steps];
  const out = [...steps];
  const [moved] = out.splice(from, 1);
  if (moved) out.splice(target, 0, moved);
  return out;
}

/**
 * Options for a step's model select, from the registry's model list. The
 * leading blank option is "use the automation's default", which is what
 * `model: ""` means on a step — so a step that has not chosen stays honest
 * rather than silently inheriting whichever model sorts first.
 */
export function modelOptions(models: readonly Model[]): { value: string; label: string }[] {
  return [
    { value: ``, label: `Automation default` },
    ...models.map((m) => ({ value: m.id, label: m.label })),
  ];
}

/**
 * Rows per step: the text, then the model select. `models` is injected so
 * the section stays pure — the host fetches the list from IN1 and passes it
 * in; this file never touches a provider.
 */
function stepRows(draft: Draft, models: readonly Model[]): Row[] {
  const steps = stepsOf(draft);
  if (steps.length === 0) {
    return [{ kind: `text`, id: `prompt.none`, label: `No prompt yet`, value: ``,
      description: `Add a step. Each step has its own text and model.`, disabled: true }];
  }
  return steps.flatMap((s, i): Row[] => [
    { kind: `text`, id: `step.${s.id}.text`, label: steps.length === 1 ? `Prompt` : `Step ${i + 1}`,
      value: s.text, placeholder: `What should this step do?` },
    { kind: `select`, id: `step.${s.id}.model`, label: `Model`, value: s.model,
      options: modelOptions(models) },
  ]);
}

/** The section AU2 renders. `order: 20` puts it after Triggers, per the plan. */
export const promptsSection = (models: readonly Model[]): SectionSpec => ({
  id: `prompts`,
  title: `Prompts`,
  blurb: `One prompt, or a chain. Later steps see earlier output.`,
  order: 20,
  build: (draft) => stepRows(draft, models),
});
