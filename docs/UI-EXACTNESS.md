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
| sidebar `220px`, from memory | `220px` | `.sx-16grhtn` — **it got lucky** |

That last row is the important one. The stylesheet holds **118 distinct width
values**. Guessing and landing on a real one is a coin flip, not parity. A
right answer with no citation is indistinguishable from a wrong one, so the
gate treats both as failures.

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
#   sx-16grhtn => .sx-16grhtn{width:220px}
#   sx-11iknt3 => .sx-11iknt3{padding-left:6px}
```

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
      "cite": "style-*.css .sx-16grhtn (used by LinearLayout.*.js)" },
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
