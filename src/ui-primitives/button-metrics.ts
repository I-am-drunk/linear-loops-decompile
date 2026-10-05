/**
 * Button sizes, read out of `Button.*.js`.
 *
 * Every value here was dereferenced to a NAMED size key (`small` / `medium` /
 * `normal` / `large`) on one of Button's style objects, not swept out of the
 * stylesheet by frequency. The key name is what makes the citation checkable;
 * see ui-facts.json for the class each value resolved through.
 *
 * Note `large` reuses `normal`'s min-width (32px) and font-size (.8125rem) —
 * it is taller and wider-padded, not bigger type. That asymmetry is in the
 * corpus; do not "fix" it.
 */
export type ButtonSize = "small" | "medium" | "normal" | "large";

export interface ButtonMetrics {
  /** height, px */
  readonly height: number;
  /** min-width, px — keeps an icon-only button square */
  readonly minWidth: number;
  /** font-size, as authored (rem) */
  readonly fontSize: string;
  /** padding-left and padding-right, px */
  readonly paddingInline: number;
}

export const BUTTON_SIZES: Readonly<Record<ButtonSize, ButtonMetrics>> = {
  small: { height: 24, minWidth: 24, fontSize: "0.75rem", paddingInline: 8 },
  medium: { height: 28, minWidth: 28, fontSize: "0.75rem", paddingInline: 10 },
  normal: { height: 32, minWidth: 32, fontSize: "0.8125rem", paddingInline: 12 },
  large: { height: 44, minWidth: 32, fontSize: "0.8125rem", paddingInline: 18 },
};

export const BUTTON_SIZE_ORDER: readonly ButtonSize[] = [
  "small",
  "medium",
  "normal",
  "large",
];

/**
 * `border-radius: 9999px` — Button's `base` style object (class sx-1m94j66).
 * Linear's buttons are pills, not 6px-rounded rectangles. This is the single
 * value most likely to be invented from memory, and it is the most visible.
 */
export const BUTTON_RADIUS = "9999px";

/** `border-radius: 50%` — the `circle` variant (sx-16rqkct). */
export const BUTTON_CIRCLE_RADIUS = "50%";

/**
 * The variant names Button itself declares as style objects. Ours is a subset:
 * we render primary/secondary/ghost/link today. `dangerous` and `circle` exist
 * in the corpus and are listed so nobody re-derives the taxonomy.
 */
export const BUTTON_VARIANTS = [
  "primary",
  "secondary",
  "ghost",
  "link",
  "dangerous",
] as const;

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];
