import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDoc, escapeHtml, isSafeHref } from "./render.ts";
import type { Doc } from "./model.ts";

test("escapes & first so entities are not mangled", () => {
  assert.equal(escapeHtml(`&<>"`), "&amp;&lt;&gt;&quot;");
});

test("a text node is escaped, not passed through", () => {
  const doc: Doc = [
    { kind: "paragraph", children: [{ kind: "text", text: `<img src=x onerror=1>` }] },
  ];
  const html = renderDoc(doc);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test("marks apply in a fixed order, so output is deterministic", () => {
  const a = renderDoc([
    { kind: "paragraph", children: [{ kind: "text", text: "x", marks: ["em", "strong"] }] },
  ]);
  const b = renderDoc([
    { kind: "paragraph", children: [{ kind: "text", text: "x", marks: ["strong", "em"] }] },
  ]);
  assert.equal(a, b);
});

// --- link scheme safety -------------------------------------------------
// This tier renders model output. A javascript: href is not an escaping
// problem — escaping it still leaves a scheme the browser will run — so it
// must be rejected outright.

test("javascript: is rejected, in any casing", () => {
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref("JaVaScRiPt:alert(1)"), false);
});

test("control characters cannot split a scheme past the check", () => {
  // Browsers treat java\nscript: as javascript:. Without stripping control
  // chars first, this would not parse as a URL and would fall through to the
  // relative-href branch — allowed.
  assert.equal(isSafeHref("java\nscript:alert(1)"), false);
  assert.equal(isSafeHref("java\tscript:alert(1)"), false);
  assert.equal(isSafeHref("  javascript:alert(1)"), false);
});

test("data: and vbscript: are rejected — allowlist, not blocklist", () => {
  assert.equal(isSafeHref("data:text/html,<script>x</script>"), false);
  assert.equal(isSafeHref("vbscript:msgbox"), false);
});

test("http, https, mailto and relative hrefs are allowed", () => {
  for (const h of ["https://x.com", "http://x.com", "mailto:a@b.c", "/runs/4", "#top", "docs/x"]) {
    assert.equal(isSafeHref(h), true, h);
  }
});

test("an empty or whitespace-only href is rejected", () => {
  assert.equal(isSafeHref(""), false);
  assert.equal(isSafeHref("   "), false);
});

test("an unsafe link keeps its text but loses the anchor", () => {
  const html = renderDoc([
    {
      kind: "paragraph",
      children: [
        { kind: "link", href: "javascript:alert(1)", children: [{ kind: "text", text: "click" }] },
      ],
    },
  ]);
  assert.equal(html, "<p>click</p>");
});

test("a safe link gets rel=noopener noreferrer", () => {
  const html = renderDoc([
    {
      kind: "paragraph",
      children: [
        { kind: "link", href: "https://x.com", children: [{ kind: "text", text: "x" }] },
      ],
    },
  ]);
  assert.match(html, /rel="noopener noreferrer"/);
});

// --- block rendering ----------------------------------------------------

test("all six heading levels render their own tag", () => {
  for (const level of [1, 2, 3, 4, 5, 6] as const) {
    const html = renderDoc([
      { kind: "heading", level, children: [{ kind: "text", text: "t" }] },
    ]);
    assert.equal(html, `<h${level}>t</h${level}>`);
  }
});

test("a code block escapes its body and never interprets marks", () => {
  const html = renderDoc([
    { kind: "code", text: `<script>alert(1)</script>`, language: "js" },
  ]);
  assert.match(html, /<pre><code class="lang-js">/);
  assert.doesNotMatch(html, /<script>/);
});

test("a code block language is escaped — it reaches an attribute", () => {
  const html = renderDoc([
    { kind: "code", text: "x", language: `js" onload="1` },
  ]);
  assert.doesNotMatch(html, /onload="1"/);
  assert.match(html, /&quot;/);
});

test("nested lists and quotes recurse", () => {
  const html = renderDoc([
    {
      kind: "list",
      ordered: false,
      items: [
        [{ kind: "paragraph", children: [{ kind: "text", text: "a" }] }],
        [
          {
            kind: "quote",
            children: [
              { kind: "paragraph", children: [{ kind: "text", text: "b" }] },
            ],
          },
        ],
      ],
    },
  ]);
  assert.equal(
    html,
    "<ul><li><p>a</p></li><li><blockquote><p>b</p></blockquote></li></ul>",
  );
});

test("an unknown block kind throws rather than rendering nothing", () => {
  assert.throws(
    // @ts-expect-error deliberately off-contract
    () => renderDoc([{ kind: "mystery", children: [] }]),
    /unknown block kind/,
  );
});

test("an unknown inline kind throws too", () => {
  assert.throws(
    () =>
      renderDoc([
        // @ts-expect-error deliberately off-contract
        { kind: "paragraph", children: [{ kind: "mystery" }] },
      ]),
    /unknown inline kind/,
  );
});

test("an empty doc renders empty, not undefined", () => {
  assert.equal(renderDoc([]), "");
});
