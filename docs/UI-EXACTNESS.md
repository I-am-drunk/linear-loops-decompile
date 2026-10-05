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

That last row is the important one, and it is worse than a near-miss. The
stylesheet holds **118 distinct width values**, so 220px was always likely to
appear somewhere. It does — as a **tab** width. The agent reported it as a
lucky hit; it was not. **It is the right number for a different component**
that happens to share a width.

**This is the shape of error that gets approved.** A reviewer checking the
citation the shallow way — run `sx.sh`, see `width:220px`, confirm 220px is in
the stylesheet, approve — passes it. The grep proves the value is *declared*,
never that it is declared for *your element*. Only dereferencing the class
into the component's JSX catches it, which is why step 3 below says to do
exactly that.

So: a right answer with no citation is indistinguishable from a wrong one, and
a citation you have not dereferenced is barely better than none.

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

`src/ui-theme` reimplements Linear's `generateTheme` and is golden-tested, so
its 116 tokens are exact **by construction**. Consume them as `--t-*` CSS
variables. Never write a hex literal in a UI file — the checker greps for them
and fails. The September audit found three "extracted" palette anchors that
were GitHub's colors, not Linear's; that is what hand-picked hexes get you.

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

1. every UI package declares `ui-facts.json`
2. no colour literals in UI source
3. every dimensional value in the CSS appears in `ui-facts.json`
4. every fact carries a citation

Legs 1–4 need no corpus and run on every PR in CI as a required check. The
corpus-gated leg re-reads each cited value and compares it; run that locally.
