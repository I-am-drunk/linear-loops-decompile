/**
 * Leg 6: does a fact's SCOPE cover the selector that uses its value?
 *
 * The gap (#360): legs 1-5 verify a value is DECLARED somewhere in
 * ui-facts.json, never that it belongs to the element using it. With 231
 * spacing declarations over 38 distinct values — the top eight covering 58% —
 * almost any invented dimension collides with some real fact. That is how
 * `gap: 6px` shipped on a button, justified by the INPUT padding.
 *
 * Why not infer scope from the selector: I measured that first. Requiring a
 * fact NAME to share a non-generic word with the selector flagged 13 of 38
 * correctly-cited values, because a selector is our class naming and a fact
 * name describes Linear's element — `.btn` vs `button`, `.doc h1` vs
 * `editor heading 1`. Both are right; word overlap is the wrong test. Leg 5
 * can compare a fact name to a custom-property name because those are two
 * descriptions of the same thing; a selector is not.
 *
 * So scope is DECLARED, not inferred. Opt-in per package: a facts file with
 * no `scope` anywhere behaves exactly as before.
 */

/** A selector matches a scope entry if the entry appears in it verbatim. */
export function scopeCovers(scope, selector) {
  if (!Array.isArray(scope) || scope.length === 0) return false;
  return scope.some((s) => typeof s === 'string' && s !== '' && selector.includes(s));
}

/**
 * Is this text plausibly a CSS selector, rather than a line of TypeScript
 * that happens to open a brace?
 *
 * The gate scans `.ts` files (our stylesheets are template literals inside
 * them), so the tracker meets code as well as CSS. Without this,
 * `export const BUTTON_SIZES: Readonly<Record<...>> = {` was taken as a
 * selector and every value in the object was reported as out-of-scope —
 * four false positives, found by adopting leg 6 in src/ui-primitives.
 *
 * A selector starts with `.`, `#`, `[`, `:`, `*`, `&` or a bare tag name.
 * Anything containing `=`, `(`, `>` outside a combinator position, or a
 * reserved word is code. Conservative: unrecognised text yields no selector,
 * which makes leg 6 skip rather than accuse.
 */
const CODE_WORDS = /\b(export|const|let|var|function|return|if|for|while|class|interface|type|new|await|async)\b/;

export function looksLikeSelector(head) {
  if (head === '' || head.startsWith('@')) return false;
  if (CODE_WORDS.test(head)) return false;
  // `=` is legal INSIDE an attribute selector (`[data-size="small"]`), so
  // only reject it outside brackets — that is assignment, i.e. code.
  // Rejecting `=` outright killed every attribute selector; caught by the
  // existing tracker test rather than by reading this back.
  if (/[=(]/.test(head.replace(/\[[^\]]*\]/g, ''))) return false;
  return /^[.#[:*&]|^[a-zA-Z][a-zA-Z0-9-]*\b/.test(head);
}

/**
 * Track the enclosing selector across lines of a stylesheet.
 *
 * Deliberately not a CSS parser. It handles the one shape our stylesheet
 * modules use — a selector line opening a block, declarations, a closing
 * brace — and returns '' when it cannot tell, which makes the leg skip rather
 * than accuse. A leg that guesses wrong is worse than one that abstains.
 */
export function selectorTracker() {
  let depth = 0;
  let selector = '';
  return function next(line) {
    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;
    // A selector is text before the first { on a line that opens a block.
    if (opens > 0 && depth === 0) {
      const head = line.slice(0, line.indexOf('{')).trim();
      if (looksLikeSelector(head)) selector = head;
    }
    const before = selector;
    depth += opens - closes;
    if (depth <= 0) {
      depth = 0;
      // A single-line rule (`.x { y: 1px }`) must still report its selector
      // for THIS line, so reset after returning.
      if (closes > 0) selector = '';
    }
    return opens > 0 || closes > 0 ? before : selector;
  };
}
