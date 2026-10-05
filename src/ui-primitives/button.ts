/**
 * Button markup.
 *
 * Zero-dep: returns an HTML string, so there is no framework to agree on
 * before the shell can render. Size and variant are data attributes, matching
 * the selectors in style.css.ts, which keeps every dimension in one place
 * where ui-facts.json can account for it.
 */
import { BUTTON_SIZES, type ButtonSize, type ButtonVariant } from "./button-metrics.ts";

export interface ButtonProps {
  readonly label: string;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
  readonly href?: string;
  readonly disabled?: boolean;
}

/** HTML-escape text destined for a text node or a double-quoted attribute. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function button(props: ButtonProps): string {
  const size: ButtonSize = props.size ?? "normal";
  const variant: ButtonVariant = props.variant ?? "secondary";

  // Fail loudly on an unknown size rather than render an unstyled control:
  // the selectors are data-attribute based, so a typo would silently drop
  // every dimension and still look like a button.
  if (!(size in BUTTON_SIZES)) {
    throw new Error(`button: unknown size ${JSON.stringify(size)}`);
  }

  const attrs = [
    `class="btn"`,
    `data-size="${size}"`,
    `data-variant="${variant}"`,
  ];

  if (props.href !== undefined) {
    attrs.push(`href="${escapeHtml(props.href)}"`);
    // A disabled link is not a thing in HTML; mark it for assistive tech and
    // let the stylesheet dim it.
    if (props.disabled) attrs.push(`aria-disabled="true"`);
    return `<a ${attrs.join(" ")}>${escapeHtml(props.label)}</a>`;
  }

  attrs.push(`type="button"`);
  if (props.disabled) attrs.push("disabled");
  return `<button ${attrs.join(" ")}>${escapeHtml(props.label)}</button>`;
}
