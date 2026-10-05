# UI exactness: read this before you write one line of CSS

**The bar: our UI is the same UI Linear renders.** Not similar. Not inspired
by. The same.

Fifty agents have now failed this the identical way, including the one that
wrote this file. Read the failure, then the procedure.

## The failure, concretely

An agent built an app shell. It got the colors exactly right, because colors
come from `src/ui-theme`, a golden-backed reimplementation of Linear's theme
generator. It then invented every value the generator does not cover:

| It shipped | Linear actually uses | Where that was already written down |
|---|---|---|
| `font: 14px "Inter", system-ui` | `"Inter Variable", "SF Pro Display", -apple-system, …` | `--font-regular` in the compiled stylesheet |
| `max-width: 860px` | `80ch` | `LayoutConstants.stylex` → `contentMaxWidth` |
| `border-radius: 5px` | a 2/3/6/8px ladder (5px is its rarest) | 57 radius declarations in the stylesheet |
| sidebar `220px`, from memory | `220px` is a **tab** width | `.sx-16grhtn` is `kzqmXN` on `LinearLayout`'s `tab` style object; `LinearLayout` has no sidebar style key at all |
| `gap: 6px` on a button | Button declares **no gap** in any of its 107 classes | `6px` is the INPUT padding — a real value for a different element, and the gate passed it |

The last two rows are the important ones, and they are worse than a
near-miss. The stylesheet holds **118 distinct width values**, so 220px was
always likely to appear somewhere. It does — as a **tab** width. The agent
reported it as a lucky hit; it was not. **It is the right number for a
different component** that happens to share a width.

The gap row is the same error, committed later by the agent who wrote this
file, in the package built to prevent it. Spacing is where it is likeliest:
231 spacing declarations over only 38 distinct values, the top eight
(`12px 8px 6px 4px 2px 16px 1px 24px`) covering 58% of them. Guess a spacing
value and you will probably hit a real one.

**This is the shape of error that gets approved.** A reviewer checking the
citation the shallow way — run `sx.sh`, see `width:220px`, confirm 220px is in
the stylesheet, approve — passes it. The grep proves the value is *declared*,
never that it is declared for *your element*. Only dereferencing the class
into the component's JSX catches it, which is why step 3 below says to do
exactly that.

So: a right answer with no citation is indistinguishable from a wrong one, and
a citation you have not dereferenced is barely better than none.

The gate now has a leg for exactly this (`scope`, leg 6): declare the
selectors a fact may justify, and a value used outside them fails. It is
opt-in per fact, because the gate cannot infer scope — your selector is
`.btn`, the fact is "button border radius", and a word-matching rule flagged
13 of 38 correct values when tried. Declaring the scope is the cheap half of
dereferencing; it does not replace reading the element.

The agent then wrote "verified in a browser" in its PR, having taken a
screenshot and judged it plausible. The owner looked at the same screenshot
and said it looks nothing like Linear. Both were looking at identical pixels.
**Plausibility is not a measurement.**

## Why "it looked right to me" will keep failing

You do not have Linear open. You have a recollection of a screenshot. That
recollection reproduces the *gestalt* — dark sidebar left, nav items, content
right — and invents the *metrics*, which are what actually make a UI look like
itself. Spacing, weight, radius and type scale are the entire difference
between "a dark app" and "Linear".

So the rule is not "be careful". The rule is: **you may not write a value you
did not read.**

## The procedure

### 1. Get the corpus (once, ~3 minutes)

```bash
bash pipeline/run.sh
```

Public static assets. No credentials, no account, no vault. Produces
gitignored `pipeline/corpus/` — ~1,559 JS chunks plus the ~566 KB compiled
stylesheet. If you skipped this you cannot do UI work; there is nothing else
to read.

### 2. Find the component that renders your surface

```bash
ls pipeline/corpus/client/ | grep -i sidebar     # or Automation, Settings, …
```

The app shell is `LinearLayout.*.js`. The automations surfaces are
`AutomationPage.*.js` and `AutomationRunsPage.*.js`. Component names survived
minification, so grep finds them.

### 3. Resolve its StyleX classes to real declarations

Linear compiles styles to atomic classes (`sx-16grhtn`). The chunk tells you
which classes a component uses; the stylesheet tells you what they mean.

```bash
# every class a component uses
LC_ALL=C grep -oaE 'sx-[a-z0-9]+' pipeline/corpus/client/LinearLayout.*.js | sort -u

# what any class actually declares
bash pipeline/sx.sh sx-16grhtn sx-11iknt3
#   sx-16grhtn => .sx-16grhtn{width:220px}      <- on a tab-bar filler, NOT the sidebar
#   sx-11iknt3 => .sx-11iknt3{padding-left:6px}
```

**Always dereference: grep the class back into the chunk and read its JSX.**
Classes live in style objects keyed by component part, so the object name tells
you what the value is FOR:

```bash
LC_ALL=C grep -oa 'kzqmXN:.sx-16grhtn' pipeline/corpus/client/LinearLayout.*.js
#   -> found on the `tab:{...}` style object, not a sidebar one
```

That is how the 220px error above was caught, and skipping this step is how it
would have shipped a second time.

That is the whole technique. Values are one grep away, which is what makes
guessing inexcusable rather than merely sloppy.

### 4. Write them into `ui-facts.json`, with citations

Your package ships `ui-facts.json` beside its code. **A UI package without one
cannot pass `ci/check-ui.sh`** — not "should not"; the gate exits 1 and CI
fails the PR.

```json
{
  "surface": "app-shell",
  "facts": [
    { "name": "sidebar width", "value": "220px",
      "cite": "style-*.css .sx-1abc234, on the sidebar container in PageSidebarContainer" },
    { "name": "content max width", "value": "80ch",
      "cite": "LayoutConstants.stylex.*.js contentMaxWidth" }
  ]
}
```

Every value in your CSS appears here. If a value is not here, delete it from
your CSS — you made it up.

### 5. Colors come from the generator, never from your eyes

`src/ui-theme` reimplements Linear's `generateTheme`, so its 116 tokens are
exact **in algorithm** — the function is reproduced, not its output sampled.
Consume them as `--t-*` CSS variables. Never write a hex literal in a UI file;
the checker greps for them and fails. The September audit found three
"extracted" palette anchors that were GitHub's colors, not Linear's — that is
what hand-picked hexes get you.

One caveat, so nobody over-reads "exact": the theme goldens compare raw floats,
and `Math.cbrt`/`Math.pow` in the OkLab→P3 path are not specified to
bit-exactness. V8 changed between majors, so the same code yields last-digit
differences — `src/ui-theme` is 13/13 on Node 22 and 10/13 on Node 24
(issue #333). The algorithm is exact; its 17th significant digit is a property
of the engine. Still far better than hand-picked values, but a byte-comparison
here pins the runtime as well as the code.

A second caveat, and this one bites in practice: "reproduced from the
generator" is exact for what `generateTheme` **returns**, which is not always
what a component **consumes**. Where a StyleX var group publishes the same
key, that group wins.

`theme.inputBorderRadius` is `8px`. Linear's inputs render at `5px`:
`ThemeProvider.*.js` publishes a var group (`__varGroupHash__` `sx-18yeszy`)
whose `--sx-ykavoc` is `5px`, consumed by `.sx-1mecoeu{border-radius}`, which
sits on the `inputBase` style object in `Input.*.js`. The other four input
metrics agree across both layers, which is what makes the radius easy to miss.

`src/ui-theme` is correct to return 8px — its goldens are **executed from the
corpus generator**, so they record what the function genuinely computes. I
filed that as a bug (#354), changed it to 5px, and broke 9 of 13 tests; the
red suite was the signal, not an obstacle. The fix is to read the component's
value and cite the var group, not to edit the generator.

So: a theme field is exact evidence about the theme. For "what does this
element render with", dereference to the element — the same rule as every
other value in this document.

## Can't find a value?

Mark it `UNVERIFIED` in `ui-facts.json` with a one-line note on where you
looked, and **leave the property out of your CSS** rather than filling it with
a plausible number. The checker enforces this: `UNVERIFIED` satisfies the
citation requirement but does NOT license using the value.

A missing border is an obvious gap someone fixes. An invented 5px radius is a
lie that survives review, because it looks fine.

Partial surfaces are fine and expected. Invented ones are not.

## What a green checker does and does not prove

Be precise about this, because "the gate passed" is how invented UI shipped
last time.

**Legs 1–4 are corpus-free by design.** They cannot tell whether a citation is
true — only whether one exists. A fact row with `"cite": "vibes"` passes all
four legs and exits 0. A peer session confirmed this by trying four ways to
smuggle invented UI through, including abusing the `UNVERIFIED` escape hatch;
the only one that worked was writing a false citation.

So green means something narrower than "the values are right":

> **Invention now requires forging a citation instead of just typing a
> number.**

That is a real raise — it turns an easy mistake into a deliberate lie, and a
reviewer can spot-check any row in one command. It is not a proof of
correctness.

**The leg that does prove values** is the corpus-gated one: it re-reads each
cited value and compares. Run it locally before you ship, and if you are
reviewing a UI PR, run it rather than trusting the green tick:

```bash
bash ci/check-ui.sh      # needs pipeline/corpus — see step 1
```

If you are reviewing and cannot run it, say so in your review instead of
approving on the corpus-free legs alone.

## Run the gate before you push

```bash
node tools/ui-facts/main.mjs .     # ~1s, no corpus needed
bash ci/check-ui.sh                # adds the corpus value comparison
```

What `ui-facts` checks:

0. a package shipping a stylesheet **declares** it ships UI
1. every UI package declares `ui-facts.json`
2. no colour literals in UI source
3. every dimensional value in the CSS appears in `ui-facts.json`
4. every fact carries a citation
5. *(corpus only)* a citation that resolves but does not **support** its claim

Legs 0–4 need no corpus and run on every PR in CI as a required check. Leg 5
needs the stylesheet, so it runs locally — and it is the one that catches the
hardest error, so run it before you ship.

### Leg 5: a citation can resolve and still be wrong

The failure it catches, found by a session who refused it by hand: `.875rem`
occurs in Linear's stylesheet only as `--editor-h5-font-size`. Citing it for a
settings heading is *true about the value and false about the claim* — the grep
resolves, the fact is still invented. They changed the declaration to the
cited `.8125rem` instead, which is the right instinct.

So leg 5 fires when **every** occurrence of a cited value is a custom-property
definition whose name shares no meaningful word with the fact's own name.
Generic CSS nouns (`size`, `width`, `color`, `font`…) are excluded from that
overlap test — "size" appearing in both `settings heading size` and
`--editor-h5-font-size` is not evidence they describe the same element, and
counting it suppressed the real case.

### Declaring a UI package

Add `"ui": true` to your package's `package.json` (a `ui-facts.json` counts
too). The gate then scans every source file in it, whatever they are named.

This is a declaration rather than a sniff, and the reason is worth knowing.
Detection originally keyed on `*.css.ts`, which let a package using `style.ts`
skip the gate entirely. The obvious fix — grep every file for CSS-looking
text — was worse: it flagged all 27 packages, because `{ ".html": "text/html" }`
in `src/server/http.ts` and a `color:` property in the theme generator are
indistinguishable from CSS without a parser. So a package says what it is, and
leg 0 catches the one case declaration cannot: a file *named* like a
stylesheet in a package that declared nothing.

## Where CI runs these

Inside `ci/check-src.sh`, which `.github/workflows/typecheck.yml` executes as
the **required** check — so the legs run on every PR. `ci/check-ui.sh` runs
them too; the leg that always runs must not be the one that can be skipped.

A dedicated `ui-exactness` workflow is written but **parked** at
`docs/ci-ui-exactness.yml.txt`: the agent token carries no `workflow` scope and
cannot create files under `.github/workflows/` (issue #331). Enforcement is
live regardless, via the required check above. To split the legs into their own
named job, move that file to `ui-exactness.yml` under `.github/workflows/`.

