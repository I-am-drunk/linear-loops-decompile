/**
 * T-1104 — one-line live/demo status note styling. Follows the house
 * pattern (a <style> component mounted once by the registry); theme tokens
 * come from src/theme.css.
 */
import type { JSX } from "react";

export function LiveStyles(): JSX.Element {
  return (
    <style>{`
.live-note {
  padding: 0 24px 8px;
  font-size: 12px;
  color: var(--text-tertiary, #8a8f98);
}
.live-note-on {
  color: var(--text-secondary, #b4b9c2);
}
.live-note-on::before {
  content: "";
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: var(--green, #4cb782);
}
`}</style>
  );
}
