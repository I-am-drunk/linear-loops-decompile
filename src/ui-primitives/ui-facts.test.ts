import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PRIMITIVES_CSS } from "./style.css.ts";

const FACTS = JSON.parse(
  fs.readFileSync(new URL("./ui-facts.json", import.meta.url), "utf8"),
) as { facts: Array<{ name: string; value: string; cite: string }> };

const DIM = /(?<![\w-])-?\d*\.?\d+(?:px|rem|em|ch|%)/g;

test("every fact carries a citation naming a corpus artifact", () => {
  for (const f of FACTS.facts) {
    assert.ok(f.cite && f.cite.length > 20, `${f.name}: thin citation`);
    assert.match(
      f.cite,
      /\.js|style-\*\.css|--sx-/,
      `${f.name}: citation names no corpus artifact`,
    );
  }
});

test("no fact value is a bare number — units are part of the fact", () => {
  for (const f of FACTS.facts) {
    if (/^\d+$/.test(f.value)) {
      assert.fail(`${f.name} = ${f.value} has no unit`);
    }
  }
});

/**
 * The gate checks that every CSS dimension appears SOMEWHERE in the facts. It
 * cannot check that the value reached the right element — that is how a `6px`
 * gap passed here while citing the INPUT padding, the same wrong-element
 * failure as the sidebar-width case in docs/UI-EXACTNESS.md.
 *
 * This closes it for buttons specifically: a dimension inside a `.btn` rule
 * must be justified by a fact whose NAME mentions the button, not by any fact
 * that happens to share the number.
 */
test("every dimension in a .btn rule is cited by a button-named fact", () => {
  const buttonValues = new Set(
    FACTS.facts
      .filter((f) => /button/i.test(f.name))
      .flatMap((f) => [...String(f.value).matchAll(DIM)].map((m) => m[0])),
  );

  // Track the enclosing selector. Matching only lines that literally contain
  // ".btn" missed every declaration INSIDE the block — which is most of them,
  // and is how a re-introduced `gap: 6px` slipped past this test's first
  // version. Verified by mutation: adding that gap back must fail here.
  let selector = "";
  for (const line of PRIMITIVES_CSS.split("\n")) {
    const open = line.match(/^(\S[^{]*)\{/);
    if (open) selector = open[1]!;
    if (line.trim() === "}") selector = "";
    if (!selector.includes(".btn")) continue;
    for (const m of line.matchAll(DIM)) {
      assert.ok(
        buttonValues.has(m[0]),
        `${m[0]} is in a .btn rule but no button-named fact declares it`,
      );
    }
  }
});

/**
 * A backtick inside a `...` stylesheet literal terminates it, and Node's type
 * stripping reports the failure at a confusing offset — it cost me two debug
 * cycles across SH1 and SH2, both times from writing `focus` in a CSS comment.
 * The gate cannot see it (the file will not parse, so nothing imports it).
 */
test("the stylesheet literal contains no stray backticks", () => {
  const src = fs.readFileSync(
    new URL("./style.css.ts", import.meta.url),
    "utf8",
  );
  const ticks = (src.match(/`/g) ?? []).length;
  assert.equal(
    ticks,
    2,
    `expected exactly the literal's open and close backticks, found ${ticks}` +
      " — a backtick inside the CSS body breaks the module",
  );
});
