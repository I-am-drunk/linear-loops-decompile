/**
 * The shared node model.
 *
 * One tier, consumed by both the prompt editor (AU4) and the run transcript
 * (AU6). Two earlier eras scheduled this twice as "editor, later" and it is
 * not severable — a transcript and a prompt draft render the same inline
 * marks over the same block containers.
 *
 * Deliberately NOT a markdown parser. This is the model a renderer walks;
 * parsing markdown INTO it is a separate concern (see parse.ts), so the
 * renderer can be tested against hand-built trees and the parser against
 * strings, without either hiding bugs in the other.
 */

/** Inline marks. A span carries a set of them, not a nesting of wrappers. */
export type Mark = "strong" | "em" | "code" | "strike";

export interface TextNode {
  readonly kind: "text";
  readonly text: string;
  readonly marks?: readonly Mark[];
}

export interface LinkNode {
  readonly kind: "link";
  readonly href: string;
  readonly children: readonly InlineNode[];
}

export type InlineNode = TextNode | LinkNode;

export interface ParagraphNode {
  readonly kind: "paragraph";
  readonly children: readonly InlineNode[];
}

export interface HeadingNode {
  readonly kind: "heading";
  /**
   * 1-6. I first wrote "1-3, Linear's editor offers three levels" from
   * memory; the stylesheet defines --editor-h1-font-size through
   * --editor-h6-font-size, so six is the real answer. Sizes are cited in
   * ui-facts.json. Note h5 and h6 share .875rem.
   */
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly children: readonly InlineNode[];
}

export interface CodeBlockNode {
  readonly kind: "code";
  readonly text: string;
  readonly language?: string;
}

export interface ListNode {
  readonly kind: "list";
  readonly ordered: boolean;
  readonly items: readonly (readonly BlockNode[])[];
}

export interface QuoteNode {
  readonly kind: "quote";
  readonly children: readonly BlockNode[];
}

export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | CodeBlockNode
  | ListNode
  | QuoteNode;

export type Doc = readonly BlockNode[];
