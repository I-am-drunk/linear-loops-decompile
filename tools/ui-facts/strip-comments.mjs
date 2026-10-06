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
 * Preserve quoted strings and CSS url(...) tokens: their slashes are data,
 * not JavaScript comments. Otherwise an https:// URL silently hides every
 * declaration that follows it on the line.
 */
export function stripComments(line, inBlock) {
  let out = '';
  let i = 0;
  let quote = '';
  let urlDepth = 0;
  while (i < line.length) {
    if (inBlock) {
      const close = line.indexOf('*/', i);
      if (close === -1) return { code: out, stillInBlock: true };
      inBlock = false;
      i = close + 2;
      continue;
    }
    if (quote || urlDepth > 0) {
      const c = line[i];
      out += c;
      i += 1;
      if (c === '\\' && i < line.length) {
        out += line[i++];
      } else if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '(') {
        urlDepth += 1;
      } else if (c === ')') {
        urlDepth -= 1;
      }
      continue;
    }
    if (line[i] === '"' || line[i] === "'") {
      quote = line[i];
      out += line[i++];
      continue;
    }
    if (line.slice(i, i + 4).toLowerCase() === 'url('
      && (i === 0 || !/[\w-]/.test(line[i - 1]))) {
      urlDepth = 1;
      out += line.slice(i, i + 4);
      i += 4;
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
