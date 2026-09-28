/**
 * LoopViewType — clean reimplementation of the corpus chunk
 * `LoopViewType.BzPUaBkC.js` (matrix §A "Loop view types" row). Original
 * code; every value below is verified against the committed corpus-executed
 * golden (`golden/loop-view-type.module-surface.expected.json`) — see
 * `corpus-manifest.json` and the golden test.
 *
 * The corpus chunk exports (`export{n, t as r, e as t}`):
 *   `t` — the view-type enum object `{myLoops: "my-loops", all: "all"}`
 *   `r` — the display-label map keyed by the enum VALUES
 *         (`{"my-loops": "My loops", all: "All"}` — a computed-key literal
 *         `{[e.myLoops]: …}` in the source)
 *   `n` — the validator: true iff the argument is one of the enum's values
 *         (`Object.values(e).some(v => v === t)`)
 *
 * Key ORDER is part of the golden bytes (own-key order: myLoops before all;
 * "my-loops" before "all"), so the literals below preserve it. Zero runtime
 * deps, strip-only TS (const objects, no enum syntax — AGENTS.md style rule).
 */

export const LoopViewType = {
  myLoops: `my-loops`,
  all: `all`,
} as const;

export type LoopViewTypeValue = (typeof LoopViewType)[keyof typeof LoopViewType];

export const loopViewTypeLabels: Record<LoopViewTypeValue, string> = {
  [LoopViewType.myLoops]: `My loops`,
  [LoopViewType.all]: `All`,
};

/** True iff `value` is one of the enum's VALUES (never its keys or labels). */
export function isLoopViewType(value: unknown): value is LoopViewTypeValue {
  return Object.values(LoopViewType).some((v) => v === value);
}
