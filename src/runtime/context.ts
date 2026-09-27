/**
 * Context assembler — turns a loop's prompt + its trigger target into the
 * single `message` string an exchange answers (Runner.start / Brain input).
 *
 * Two seams:
 * - `flattenPrompt` accepts the loop prompt in any shape we persist or
 *   import — our markdown `PromptContent`, a raw string, or a
 *   ProseMirror-ish JSON doc (Linear's editor format, KNOWLEDGE §3) — and
 *   returns plain text. Junk-robust: it never throws; unrecognizable input
 *   flattens to "".
 * - `EntityReader` is the dataplane seam (R3 implements it over the Linear
 *   API): target → title/description/comments. The runtime depends on the
 *   interface, never on the transport.
 *
 * NOT here (YAGNI, per the settled design): templating, token budgets,
 * memory/traits. Add behind new functions, not by growing these signatures.
 *
 * Original code.
 */

import type { PromptContent } from "../model/loop.ts";
import type { RunTarget } from "./types.ts";

/**
 * ProseMirror-ish block node types — block boundaries become newlines when
 * flattening. Anything not listed and not a text node contributes its
 * children's text inline.
 */
const BLOCK_TYPES: ReadonlySet<string> = new Set([
  "doc",
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "blockquote",
  "rule",
  "table",
  "tableRow",
  "tableCell",
]);

function nodeText(node: unknown): string {
  if (typeof node === "string") return node;
  if (node === null || node === undefined || typeof node !== "object") return "";
  if (Array.isArray(node)) return node.map(nodeText).join("");
  const rec = node as Record<string, unknown>;
  if (typeof rec["text"] === "string") return rec["text"];
  if (rec["type"] === "hardBreak") return "\n";
  const inner = Array.isArray(rec["content"]) ? nodeText(rec["content"]) : "";
  if (typeof rec["type"] === "string" && BLOCK_TYPES.has(rec["type"])) {
    return inner === "" ? "" : `${inner}\n`;
  }
  return inner;
}

/**
 * Flatten any prompt representation to plain text. Never throws.
 *
 * Accepts: markdown `PromptContent` (`{format:"markdown", markdown}`), a raw
 * string, a ProseMirror-ish doc/node. Anything else flattens to "".
 */
export function flattenPrompt(input: unknown): string {
  if (typeof input === "string") return input.trim();
  if (input === null || input === undefined || typeof input !== "object") return "";
  const rec = input as Record<string, unknown>;
  if (rec["format"] === "markdown" && typeof rec["markdown"] === "string") {
    return (input as PromptContent).markdown.trim();
  }
  return nodeText(input).replace(/\n{3,}/g, "\n\n").trim();
}

/** What the dataplane knows how to read about a run target, as text. */
export interface EntityContext {
  title: string;
  description?: string | undefined;
  comments?: readonly { author: string | null; body: string }[] | undefined;
  url?: string | undefined;
}

/**
 * The R3 dataplane implements this. `null` means the target is gone or
 * unreadable — the run proceeds with prompt-only context and
 * `entityIncluded: false`. Errors PROPAGATE: a broken dataplane must fail
 * the run visibly (Runner surfaces it as `error`), never silently degrade.
 */
export interface EntityReader {
  readEntity(target: RunTarget): Promise<EntityContext | null>;
}

export interface AssembleInput {
  /** The loop's prompt in any flattenable shape. */
  prompt: unknown;
  /** The entity the run acts on (event triggers), if any. */
  target?: RunTarget | undefined;
  /** Dataplane seam; required for entity context to be included. */
  reader?: EntityReader | undefined;
  /** Loop display name — one header line so the brain knows its job's name. */
  loopName?: string | undefined;
}

export interface AssembledContext {
  /** The assembled message, ready for Runner.start / Brain.stream. */
  message: string;
  /** Whether entity context made it into the message. */
  entityIncluded: boolean;
}

/** Build the exchange message for a run. */
export async function assembleContext(input: AssembleInput): Promise<AssembledContext> {
  const sections: string[] = [];
  if (input.loopName !== undefined && input.loopName !== "") {
    sections.push(`# ${input.loopName}`);
  }
  const promptText = flattenPrompt(input.prompt);
  if (promptText !== "") sections.push(promptText);

  let entityIncluded = false;
  if (input.target !== undefined && input.reader !== undefined) {
    const entity = await input.reader.readEntity(input.target);
    if (entity !== null) {
      entityIncluded = true;
      const targetLines: string[] = [];
      const label = input.target.label ?? entity.title;
      targetLines.push(`## Target: ${input.target.entity} ${label}`.trimEnd());
      if (entity.url !== undefined) targetLines.push(entity.url);
      if (entity.description !== undefined && entity.description !== "") {
        targetLines.push("", entity.description);
      }
      if (entity.comments !== undefined && entity.comments.length > 0) {
        targetLines.push("", "### Recent comments");
        for (const comment of entity.comments) {
          targetLines.push(`- ${comment.author ?? "unknown"}: ${comment.body}`);
        }
      }
      sections.push(targetLines.join("\n"));
    }
  }

  return { message: sections.join("\n\n"), entityIncluded };
}
