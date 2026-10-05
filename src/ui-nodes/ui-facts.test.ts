import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NODES_CSS } from "./style.css.ts";

const FACTS = JSON.parse(
  fs.readFileSync(new URL("./ui-facts.json", import.meta.url), "utf8"),
) as { facts: Array<{ name: string; value: string; cite: string }> };

test("every fact cites an --editor-* property or a corpus artifact", () => {
  for (const f of FACTS.facts) {
    assert.match(f.cite, /--editor-|--font-|\.js/, f.name);
  }
});

test("the stylesheet literal contains no stray backticks", () => {
  const src = fs.readFileSync(
    new URL("./style.css.ts", import.meta.url),
    "utf8",
  );
  const ticks = (src.match(/`/g) ?? []).length;
  assert.equal(ticks, 2, `found ${ticks} backticks; a stray one breaks parsing`);
});

/**
 * Every heading font-size in the CSS must come from the cited editor scale.
 *
 * The gate only checks a value is declared somewhere (#360), so this pins the
 * per-level mapping: h3 getting h2's size would pass the gate and fail here.
 */
test("each heading level renders at its own cited size", () => {
  for (const level of [1, 2, 3, 4, 5, 6]) {
    const fact = FACTS.facts.find(
      (f) => f.name === `editor heading ${level} font-size`,
    );
    assert.ok(fact, `no fact for h${level}`);
    const rule = NODES_CSS.split("\n").find((l) => l.includes(`.doc h${level} `));
    assert.ok(rule, `no rule for h${level}`);
    assert.ok(
      rule.includes(`font-size: ${fact.value}`),
      `h${level} should be ${fact.value}, rule is: ${rule.trim()}`,
    );
  }
});

test("h5 and h6 share a size — the scale flattens, it is not a typo", () => {
  const h5 = FACTS.facts.find((f) => f.name === "editor heading 5 font-size");
  const h6 = FACTS.facts.find((f) => f.name === "editor heading 6 font-size");
  assert.equal(h5?.value, h6?.value);
});
