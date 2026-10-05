/**
 * Node tree -> HTML string.
 *
 * This tier renders UNTRUSTED input: a run transcript holds model output, and
 * a prompt draft holds whatever a user typed. So escaping is not a detail
 * here, it is the whole job. Three rules, each with a test:
 *
 *   1. Every text node and attribute value is escaped.
 *   2. A link href must pass an allowlist of schemes. `javascript:` and
 *      `data:` are rejected, not escaped — escaping does not help when the
 *      browser will happily run a scheme we handed it.
 *   3. Unknown node kinds throw rather than render nothing, so a model
 *      emitting an unexpected shape is a loud failure, not a silent gap.
 */
import type { BlockNode, Doc, InlineNode, Mark } from "./model.ts";

/** Escape for a text node or a double-quoted attribute value. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Schemes a link may use.
 *
 * Allowlist, not a blocklist: a blocklist of `javascript:`/`data:` misses
 * `vbscript:`, control-character-split variants, and whatever a future
 * browser adds. Anything not on this list is dropped.
 */
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/**
 * True when an href is safe to emit.
 *
 * Relative hrefs (`/runs/4`, `#section`) are allowed — they cannot carry a
 * scheme. Everything else must parse as a URL with an allowed scheme.
 *
 * Control characters are stripped BEFORE parsing: `java\nscript:alert(1)` is
 * treated as `javascript:` by browsers but would not parse as a URL here, so
 * without stripping it would fall through to the relative-href branch.
 */
export function isSafeHref(href: string): boolean {
  const cleaned = href.replace(/[\u0000- \u007f]/g, "");
  if (cleaned === "") return false;
  if (cleaned.startsWith("/") || cleaned.startsWith("#")) return true;
  // A bare scheme-less path like `docs/x` is relative too, but only if the
  // first segment holds no colon — `a:b` would be parsed as a scheme.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) return true;
  try {
    return SAFE_SCHEMES.has(new URL(cleaned).protocol);
  } catch {
    return false;
  }
}

const MARK_TAG: Record<Mark, string> = {
  strong: "strong",
  em: "em",
  code: "code",
  strike: "s",
};

/** Marks are applied in a fixed order so output is deterministic. */
const MARK_ORDER: readonly Mark[] = ["strong", "em", "strike", "code"];

function renderInline(node: InlineNode): string {
  if (node.kind === "text") {
    let html = escapeHtml(node.text);
    const marks = new Set(node.marks ?? []);
    for (const m of MARK_ORDER) {
      if (!marks.has(m)) continue;
      html = `<${MARK_TAG[m]}>${html}</${MARK_TAG[m]}>`;
    }
    return html;
  }
  if (node.kind === "link") {
    const inner = node.children.map(renderInline).join("");
    if (!isSafeHref(node.href)) return inner; // drop the link, keep the text
    return `<a href="${escapeHtml(node.href)}" rel="noopener noreferrer">${inner}</a>`;
  }
  throw new Error(
    `render: unknown inline kind ${JSON.stringify((node as { kind: string }).kind)}`,
  );
}

function renderBlock(node: BlockNode): string {
  switch (node.kind) {
    case "paragraph":
      return `<p>${node.children.map(renderInline).join("")}</p>`;
    case "heading": {
      const t = `h${node.level}`;
      return `<${t}>${node.children.map(renderInline).join("")}</${t}>`;
    }
    case "code": {
      const cls =
        node.language === undefined
          ? ""
          : ` class="lang-${escapeHtml(node.language)}"`;
      return `<pre><code${cls}>${escapeHtml(node.text)}</code></pre>`;
    }
    case "list": {
      const t = node.ordered ? "ol" : "ul";
      const items = node.items
        .map((blocks) => `<li>${blocks.map(renderBlock).join("")}</li>`)
        .join("");
      return `<${t}>${items}</${t}>`;
    }
    case "quote":
      return `<blockquote>${node.children.map(renderBlock).join("")}</blockquote>`;
    default:
      throw new Error(
        `render: unknown block kind ${JSON.stringify((node as { kind: string }).kind)}`,
      );
  }
}

/** Render a whole document. */
export function renderDoc(doc: Doc): string {
  return doc.map(renderBlock).join("");
}
