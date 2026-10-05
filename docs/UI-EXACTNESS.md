# UI exactness: read this before you write one line of CSS

**The bar: our UI is the same UI Linear renders.** Not similar. Not inspired by.
The same.

Fifty agents have now failed this the identical way, including the one that
wrote this file. Read the failure, then the procedure.

## The failure, concretely

An agent built an app shell. It got the colors exactly right, because colors
come from `src/ui-theme`, a golden-backed reimplementation of Linear's theme
generator. It then invented every single value the generator does not cover:

| It shipped | Linear actually uses | Where that was written down |
|---|---|---|
| `font: 14px "Inter", system-ui` | `"Inter Variable", "SF Pro Display", -apple-system, …` | `--font-regular` in the compiled stylesheet |
| `max-width: 860px` | `80ch` | `LayoutConstants.stylex` → `contentMaxWidth` |
| `border-radius: 5px` | 2/3/6/8px ladder (5px is its rarest) | 57 radius declarations in the stylesheet |
| sidebar `220px`, invented | `220px` | `.sx-16grhtn` — **it got lucky** |

That last row is the important one. The stylesheet contains **118 distinct
width values**. Guessing and landing on a real one is a coin flip, not parity.
A right answer with no citation is indistinguishable from a wrong one, so the
gate treats both as failures.

The agent then wrote "verified in a browser" in the PR, having taken a
screenshot and thought it looked plausible. The owner looked at the same
screenshot and said it looks nothing like Linear. Both were looking at the
same pixels. Plausibility is not a measurement.

## Why "it looked right to me" will keep failing

You do not have Linear open. You have a recollection of a screenshot. Your
recollection reproduces the *gestalt* — dark sidebar on the left, nav items,
content on the right — and invents the *metrics*, which is what actually makes
a UI look like itself. Spacing, weight, radius and type scale are the whole
difference between "a dark app" and "Linear".

So the rule is not "be careful". The rule is: **you may not write a value you
did not read.**

## The procedure

### 1. Get the corpus (once, ~3 minutes)

```bash
bash pipeline/run.sh
```

Public static assets, no credentials, no account. Produces
`pipeline/corpus/` — 1,559 JS chunks plus the 566 KB compiled stylesheet, all
gitignored. If you skipped this step you cannot do UI work; there is nothing
else to read.

### 2. Find the component that renders your surface

```bash
ls pipeline/corpus/client/ | grep -i sidebar     # or Automation, Settings, …
```

The app shell is `LinearLayout.*.js`. The automations surfaces are
`AutomationPage.*.js`, `AutomationRunsPage.*.js`. Names survived minification.

### 3. Resolve its StyleX classes to real declarations

Linear compiles styles to atomic classes (`sx-16grhtn`). The chunk tells you
which classes a component uses; the stylesheet tells you what they mean.

```bash
# every class a component uses — glob the hash, never type it
LC_ALL=C grep -oaE 'sx-[a-z0-9]+' pipeline/corpus/client/LinearLayout.*.js | sort -u

# what any class actually declares
bash pipeline/sx.sh sx-16grhtn sx-11iknt3
#   sx-16grhtn => .sx-16grhtn{width:220px}
#   sx-11iknt3 => .sx-11iknt3{padding-left:6px}
```

That is the whole technique. Values are one grep away — which is what makes
guessing inexcusable rather than merely sloppy.

### 4. Write them into `ui-facts.json`, with citations

Your package ships `ui-facts.json` next to its code. **A UI package without
one cannot pass `ci/check-ui.sh`** — not "should not", cannot; the gate exits
1.

> **The gate is local-only right now (issue #331).** No CI job runs it: a
> session's token cannot push `.github/workflows/`. So nothing automated will
> catch you, and a reviewer must run it by hand. Treat that as raising the
> bar on you, not lowering it.

```json
{
  "surface": "app-shell",
  "facts": [
    { "name": "sidebar width", "value": "220px",
      "cite": "style/*.css .sx-16grhtn (used by client/LinearLayout.*.js)" },
    { "name": "content max width", "value": "80ch",
      "cite": "client/LayoutConstants.stylex.*.js contentMaxWidth" }
  ]
}
```

**Cite the export name and glob the hash.** Those `.BBj6JEjr.` segments are
content hashes Linear rotates on redeploy (issue #329), so a citation that
pins one reads as "not found" against next week's corpus even though the
value never moved. `LinearLayout.*.js` plus the class or export name is both
honest and durable.

Every value in your CSS appears here. If a value is not in here, delete it
from your CSS — you made it up.

### 5. Colors come from the generator, never from your eyes

`src/ui-theme` reimplements Linear's `generateTheme` and is golden-tested, so
its 116 tokens are exact **by construction**. Consume them as CSS variables.
Never write a hex literal in a UI file: `ci/check-ui.sh` greps for them and
fails. The September audit found three "extracted" palette anchors that were
GitHub's colors, not Linear's — that is what hand-picked hexes get you.

## Can't find a value?

Mark it `UNVERIFIED` in `ui-facts.json` with a one-line note on where you
looked, and **leave the property out of your CSS** rather than filling it with
a plausible number. A missing border is an obvious gap someone fixes. An
invented 5px radius is a lie that survives review, because it looks fine.

Partial surfaces are fine and expected. Invented ones are not.

## What the gate checks, so you can run it before pushing

```bash
bash ci/check-ui.sh
```

1. `ui-facts.json` exists for every UI package — **corpus-free, always runs**
2. no hex/rgb colour literals in UI CSS
3. every value in the CSS appears in `ui-facts.json`
4. every fact carries a citation
5. with a corpus present: each cited value is re-read and compared

Legs 1–4 need no corpus and run on every PR in CI. Leg 5 is the real
comparison and needs the corpus; run it locally before you ship.
