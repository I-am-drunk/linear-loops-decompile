/**
 * Tests for the context assembler: prompt flattening (all shapes + junk) and
 * entity-context assembly via the EntityReader seam.
 * Zero-dep: node --experimental-strip-types --test.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assembleContext, flattenPrompt } from "./context.ts";
import type { EntityReader } from "./context.ts";

describe("flattenPrompt", () => {
  it("passes through a raw string and a markdown PromptContent", () => {
    assert.equal(flattenPrompt("  hello  "), "hello");
    assert.equal(flattenPrompt({ format: "markdown", markdown: "do the thing\n" }), "do the thing");
  });

  it("flattens a ProseMirror-ish doc, blocks to newlines, hardBreak kept", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Triage the issue." }] },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "be terse" }] }] },
            { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "cite sources" }] }] },
          ],
        },
        { type: "paragraph", content: [{ type: "text", text: "line one" }, { type: "hardBreak" }, { type: "text", text: "line two" }] },
      ],
    };
    const text = flattenPrompt(doc);
    assert.ok(text.includes("Triage the issue."), "paragraph text");
    assert.ok(text.includes("be terse"), "list item 1");
    assert.ok(text.includes("cite sources"), "list item 2");
    assert.ok(text.includes("line one\nline two"), "hardBreak is a newline, no paragraph split");
    assert.ok(!/\n{3,}/.test(text), "no 3+ newline runs");
  });

  it("is junk-robust: null, numbers, odd objects, nested arrays never throw", () => {
    assert.equal(flattenPrompt(null), "");
    assert.equal(flattenPrompt(undefined), "");
    assert.equal(flattenPrompt(42), "");
    assert.equal(flattenPrompt({}), "");
    assert.equal(flattenPrompt({ content: "not-an-array" }), "");
    assert.equal(flattenPrompt([["a"], [{ text: "b" }], null]), "ab");
    assert.equal(flattenPrompt({ format: "markdown", markdown: 7 }), "");
  });
});

describe("assembleContext", () => {
  const target = { entity: "issue" as const, id: "uuid-1", label: "ABC-123" };

  it("prompt-only when there is no target", async () => {
    const out = await assembleContext({ prompt: "Summarize.", loopName: "Daily digest" });
    assert.equal(out.entityIncluded, false);
    assert.equal(out.message, "# Daily digest\n\nSummarize.");
  });

  it("includes entity context from the reader", async () => {
    const reader: EntityReader = {
      async readEntity(t) {
        assert.equal(t.id, "uuid-1");
        return {
          title: "Login is broken",
          description: "Users see a 500.",
          url: "https://linear.app/example/issue/ABC-123",
          comments: [{ author: "jane", body: "reproduced on safari" }],
        };
      },
    };
    const out = await assembleContext({ prompt: "Triage this.", target, reader });
    assert.equal(out.entityIncluded, true);
    assert.ok(out.message.includes("Triage this."));
    assert.ok(out.message.includes("## Target: issue ABC-123"));
    assert.ok(out.message.includes("Users see a 500."));
    assert.ok(out.message.includes("- jane: reproduced on safari"));
  });

  it("omits the entity section when the reader finds nothing", async () => {
    const reader: EntityReader = { async readEntity() { return null; } };
    const out = await assembleContext({ prompt: "Triage this.", target, reader });
    assert.equal(out.entityIncluded, false);
    assert.equal(out.message, "Triage this.");
  });

  it("propagates reader errors (a broken dataplane must fail visibly)", async () => {
    const reader: EntityReader = {
      async readEntity() { throw new Error("linear 429"); },
    };
    await assert.rejects(() => assembleContext({ prompt: "x", target, reader }), /linear 429/);
  });
});
