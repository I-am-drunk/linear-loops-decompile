/**
 * Blank out comment text on one line, returning the code that remains.
 *
 * The gate scans each line for CSS-looking values. Previously it skipped a
 * line only if it STARTED with a comment marker, so the 2nd and later lines of
 * a block comment were scanned as code — writing "the 220px case" in prose
 * failed the gate for a value the file never uses. Those are false positives,
 * not misses, but they teach agents to delete the explanation rather than the
 * value, which is backwards.
 *
 * Blanking rather than skipping, because code can share a line with a comment
 * on either side: `/* note *\/ .x{height:888px}` must still be checked.
 *
 * Not a tokenizer: a `/*` inside a string literal would be misread. That is
 * acceptable here — the input is our own stylesheet modules, and the failure
 * direction is a missed check on one line, never a false accusation.
 */
export function stripComments(line, inBlock) {
  let out = '';
  let i = 0;
  while (i < line.length) {
    if (inBlock) {
      const close = line.indexOf('*/', i);
      if (close === -1) return { code: out, stillInBlock: true };
      inBlock = false;
      i = close + 2;
      continue;
    }
    if (line.startsWith('//', i)) return { code: out, stillInBlock: false };
    if (line.startsWith('/*', i)) {
      inBlock = true;
      i += 2;
      continue;
    }
    out += line[i];
    i += 1;
  }
  return { code: out, stillInBlock: inBlock };
}
