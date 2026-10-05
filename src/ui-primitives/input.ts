/**
 * Text input markup.
 *
 * Zero-dep, same shape as button(): returns an HTML string with the class the
 * stylesheet targets, so every dimension stays in style.css.ts where
 * ui-facts.json accounts for it.
 *
 * Deliberately focus-unstyled — see the note in style.css.ts. Input's own
 * chunk carries no focus rule, so writing one would be invented.
 */
import { escapeHtml } from "./button.ts";

export interface InputProps {
  readonly name: string;
  readonly value?: string;
  readonly placeholder?: string;
  readonly type?: "text" | "password" | "email" | "url" | "search";
  readonly disabled?: boolean;
  readonly label?: string;
  readonly describedBy?: string;
}

export function input(props: InputProps): string {
  const attrs = [
    `class="input"`,
    `type="${props.type ?? "text"}"`,
    `name="${escapeHtml(props.name)}"`,
  ];

  // An input with neither a label nor aria-label is unreachable by name for a
  // screen reader. Refuse rather than ship one: a placeholder is not a label,
  // because it vanishes the moment the field has content.
  if (props.label === undefined && props.placeholder === undefined) {
    throw new Error(`input ${JSON.stringify(props.name)}: needs a label`);
  }
  if (props.label !== undefined) {
    attrs.push(`aria-label="${escapeHtml(props.label)}"`);
  }
  if (props.placeholder !== undefined) {
    attrs.push(`placeholder="${escapeHtml(props.placeholder)}"`);
  }
  if (props.value !== undefined) {
    attrs.push(`value="${escapeHtml(props.value)}"`);
  }
  if (props.describedBy !== undefined) {
    attrs.push(`aria-describedby="${escapeHtml(props.describedBy)}"`);
  }
  if (props.disabled) attrs.push("disabled");

  return `<input ${attrs.join(" ")} />`;
}
