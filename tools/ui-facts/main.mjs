#!/usr/bin/env node
/**
 * ui-facts: the corpus-free UI exactness checker.
 *
 * It answers one question a reviewer cannot answer by looking at a screenshot:
 * is every value in this UI traceable to something someone actually read?
 *
 * Fast on purpose — pure file reads, no corpus, no network, no toolchain. It
 * runs on every PR in a couple of seconds, which is what makes it mandatory
 * rather than aspirational.
 *
 * Legs:
 *   1. every UI package declares ui-facts.json
 *   2. no colour literals in UI source (colours come from the theme generator)
 *   3. every dimensional value in the CSS appears in ui-facts.json
 *   4. every fact carries a citation
 *
 * Leg 3 is the one that catches invention. An agent working from memory writes
 * numbers it cannot cite; this finds them without needing to know the right
 * answer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments.mjs';
import { scopeCovers, selectorTracker } from './scope.mjs';

const ROOT = process.argv[2] ?? '.';
const errors = [];
const warnings = [];
let checked = 0;

/**
 * The compiled stylesheet, when a corpus is present. Legs 0-4 never need it;
 * leg 5 (does a citation support its claim?) does, and is skipped without it.
 */
const CORPUS_CSS = (() => {
  const dir = path.join(ROOT, 'pipeline/corpus/style');
  try {
    const f = fs.readdirSync(dir).find((n) => /^style-.*\.css$/.test(n));
    return f ? fs.readFileSync(path.join(dir, f), 'utf8') : null;
  } catch {
    return null;
  }
})();

/**
 * Which files in a UI package carry CSS.
 *
 * Detection is a two-part rule, and the second part is why:
 *
 *   1. A package DECLARES whether it ships UI, via `"ui": true` in its
 *      package.json (or by having a ui-facts.json at all).
 *   2. Within such a package, every source file is scanned.
 *
 * Why not sniff content repo-wide: keying on `*.css.ts` let a package using
 * `style.ts` bypass the gate entirely (found by sess 89). The obvious fix —
 * grep every file for CSS-looking text — is worse. It flagged all 27 packages,
 * because `{ ".html": "text/html" }` in src/server/http.ts and a `color:`
 * property in the theme generator are indistinguishable from CSS without a
 * parser. Declaration is honest: a package that ships UI says so, and the
 * gate then checks it thoroughly.
 */
const SOURCE_RE = /\.(css|ts|tsx|js|jsx|mjs)$/;



function declaresUi(dir) {
  if (fs.existsSync(path.join(dir, 'ui-facts.json'))) return true;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    return pkg.ui === true;
  } catch {
    return false;
  }
}

function cssFiles(dir, prefix = ``) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === `node_modules` || e.name === `dist` || e.name === `golden`) continue;
    const rel = prefix === `` ? e.name : `${prefix}/${e.name}`;
    if (e.isDirectory()) {
      out.push(...cssFiles(path.join(dir, e.name), rel));
    } else if (SOURCE_RE.test(e.name) && !/\.test\.[a-z]+$/.test(e.name)) {
      out.push(rel);
    }
  }
  return out;
}

/** A UI package is any src/* dir that declares it ships UI. */
function uiPackages() {
  const src = path.join(ROOT, 'src');
  if (!fs.existsSync(src)) return [];
  return fs.readdirSync(src)
    .map((d) => path.join(src, d))
    .filter((d) => fs.statSync(d).isDirectory())
    .filter((d) => declaresUi(d));
}

/**
 * The honest limit of declaration-based detection: a package that declares
 * nothing is invisible. So catch the specific case that matters — a file
 * NAMED like a stylesheet in a package that never declared itself.
 *
 * Narrow on purpose. Content-sniffing every source file flagged all 27
 * packages (TS object literals look like CSS), so this checks names only, and
 * only to demand a declaration rather than to judge the values.
 */
const STYLESHEET_NAME_RE = /^(?:css|style|styles|stylesheet)\.(?:ts|tsx|js|jsx|mjs)$|\.css\.(?:ts|tsx|js|jsx|mjs)$|\.css$/;

function undeclaredUiPackages() {
  const src = path.join(ROOT, 'src');
  if (!fs.existsSync(src)) return [];
  return fs.readdirSync(src)
    .map((d) => path.join(src, d))
    .filter((d) => fs.statSync(d).isDirectory())
    .filter((d) => !declaresUi(d))
    .filter((d) => cssFiles(d).some(
      (f) => STYLESHEET_NAME_RE.test(path.basename(f)) && !/\.test\.[a-z]+$/.test(f),
    ));
}


/** Values whose exactness is visible: lengths, not counts or keywords. */
const VALUE_RE = /(-?\d*\.?\d+)(px|rem|em|ch|vh|vw|%)/g;

/**
 * Values that carry no design information and would be pure noise to cite.
 * Deliberately tiny: 0 is 0 in every design system, and 1px/100% are
 * structural rather than chosen. Everything else must be read.
 */
const FREE = new Set(['0px', '0rem', '0%', '1px', '100%', '100vh', '100vw', '0em']);

const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/g;

/**
 * Leg 5 (corpus-gated): a citation that resolves but does not SUPPORT its
 * claim. Found by sess 89, who refused such a citation by hand: `.875rem`
 * occurs in the stylesheet only as `--editor-h5-font-size`, so citing it for a
 * settings heading would be true about the value and false about the claim.
 *
 * Narrow by design — it fires only when EVERY occurrence of the cited value in
 * the stylesheet is a custom-property definition whose name shares no word
 * with the fact's own name. That is the one case where "it is in the
 * stylesheet" is demonstrably not evidence for the stated use.
 */
/**
 * CSS nouns that say nothing about SCOPE. "size" appearing in both
 * `settings heading size` and `--editor-h5-font-size` is not evidence they
 * describe the same element — it suppressed the real case this leg exists for.
 */
const GENERIC_WORDS = new Set([
  'size', 'width', 'height', 'color', 'font', 'padding', 'margin', 'gap',
  'radius', 'border', 'background', 'weight', 'line', 'space', 'spacing',
  'top', 'left', 'right', 'bottom', 'inline', 'block', 'min', 'max', 'var',
]);

function scopeMismatch(value, factName, css) {
  // Only dimensional values. A font stack, colour or keyword legitimately
  // lives as a custom property — `--font-regular` IS how you consume Linear's
  // font stack, so flagging it was a false positive on a correct citation
  // (caught reviewing PR #337). Leg 5 is about a NUMBER borrowed from a
  // differently-scoped token, which is the case that misleads.
  if (!/^-?\d*\.?\d+(px|rem|em|ch|vh|vw|%)$/.test(String(value).trim())) return null;

  const esc = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const occurrences = [...css.matchAll(new RegExp(`([-\\w]+)\\s*:\\s*${esc}\\b`, 'g'))];
  if (!occurrences.length) return null;

  const props = occurrences.map((m) => m[1]);
  if (!props.every((p) => p.startsWith('--'))) return null; // used as a real declaration somewhere

  const words = new Set(
    String(factName).toLowerCase().split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w)),
  );
  const shares = props.some((p) =>
    p.toLowerCase().split(/[^a-z0-9]+/)
      .some((w) => w.length > 2 && !GENERIC_WORDS.has(w) && words.has(w)),
  );
  if (shares) return null;

  return [...new Set(props)].join(', ');
}


// Undeclared packages that look like they ship UI. Demand a declaration; do
// not try to judge their values without one.
for (const pkg of undeclaredUiPackages()) {
  const name = path.relative(ROOT, pkg);
  errors.push(
    `${name}: ships a stylesheet but declares no UI.\n` +
    `    Add "ui": true to its package.json (or a ui-facts.json) so the gate\n` +
    `    can check its values. A UI package that declares nothing is\n` +
    `    unverifiable, which is how invented CSS shipped before.`,
  );
  checked++;
}

for (const pkg of uiPackages()) {
  checked++;
  const name = path.relative(ROOT, pkg);
  const factsPath = path.join(pkg, 'ui-facts.json');

  // --- leg 1: declaration ------------------------------------------------
  if (!fs.existsSync(factsPath)) {
    errors.push(
      `${name}: no ui-facts.json.\n` +
      `    A UI package declares the values it claims, each with the corpus\n` +
      `    citation it was read from. See docs/UI-EXACTNESS.md.`,
    );
    continue;
  }

  let facts;
  try {
    facts = JSON.parse(fs.readFileSync(factsPath, 'utf8'));
  } catch (e) {
    errors.push(`${name}/ui-facts.json: not valid JSON (${e.message})`);
    continue;
  }
  const rows = Array.isArray(facts) ? facts : (facts.facts ?? []);
  if (!rows.length) {
    errors.push(`${name}/ui-facts.json: declares zero facts, but the package ships CSS.`);
    continue;
  }

  // --- leg 4: citations --------------------------------------------------
  const declared = new Set();
  // Leg 6 (#360): value -> the scopes allowed to use it. Only populated from
  // facts that declare a `scope`, so a package with none opts out entirely.
  const scopedValues = new Map();
  let anyScope = false;
  for (const [i, r] of rows.entries()) {
    const where = `${name}/ui-facts.json[${i}]`;
    if (!r || typeof r !== 'object') { errors.push(`${where}: not an object`); continue; }
    if (!r.name) errors.push(`${where}: missing "name"`);
    if (r.value === undefined) errors.push(`${where}: missing "value"`);
    const unverified = String(r.label ?? '').toUpperCase() === 'UNVERIFIED';
    if (!r.cite && !r.citation && !unverified) {
      errors.push(
        `${where} (${r.name}): no citation.\n` +
        `    Give the file + class/identifier you read it at, or mark it UNVERIFIED\n` +
        `    and leave the property out of the CSS.`,
      );
    }
    if (!unverified) for (const m of String(r.value).matchAll(VALUE_RE)) declared.add(m[0]);

    // Collect declared scopes. A `scope` must be a non-empty array of
    // strings; anything else is a mistake worth naming, not ignoring.
    if (!unverified && r.scope !== undefined) {
      const bad = !Array.isArray(r.scope) || r.scope.length === 0
        || r.scope.some((s) => typeof s !== 'string' || s.trim() === '');
      if (bad) {
        errors.push(
          `${where} (${r.name}): "scope" must be a non-empty array of\n` +
          `    selector strings, e.g. ["\\u002ebtn"]. Omit it to opt out of leg 6.`,
        );
      } else {
        anyScope = true;
        for (const m of String(r.value).matchAll(VALUE_RE)) {
          const list = scopedValues.get(m[0]) ?? [];
          list.push(...r.scope);
          scopedValues.set(m[0], list);
        }
      }
    }

    // --- leg 5: does the citation SUPPORT the claim? (corpus-gated) -------
    if (!unverified && CORPUS_CSS) {
      const props = scopeMismatch(r.value, r.name, CORPUS_CSS);
      if (props) {
        errors.push(
          `${where} (${r.name}): \`${r.value}\` occurs in the stylesheet ONLY as\n` +
          `    ${props} — a differently-scoped custom property. The citation\n` +
          `    resolves but does not support the claim. Read the value for THIS\n` +
          `    element, or mark it UNVERIFIED and drop the property.`,
        );
      }
    }
  }

  /**
   * Leg 6 (#360): a cited value used in a selector its fact does not cover.
   *
   * Opt-in: silent unless some fact in this package declares a `scope`.
   * Abstains when the tracker could not name a selector (nested at-rules),
   * because a leg that guesses wrong is worse than one that skips.
   */
  function checkScope(pkgName, file, lineNo, value, selector) {
    if (!anyScope) return;
    if (selector === '') return;
    const allowed = scopedValues.get(value);
    if (allowed === undefined) return; // this value's facts declare no scope
    if (scopeCovers(allowed, selector)) return;
    errors.push(
      `${pkgName}/${file}:${lineNo + 1}: \`${value}\` is used in \`${selector}\`,\n` +
      `    but every fact declaring it is scoped to ${allowed.map((s) => `\`${s}\``).join(', ')}.\n` +
      `    A value being cited SOMEWHERE is not evidence for THIS element —\n` +
      `    that is how a 6px button gap passed, justified by the input padding.\n` +
      `    Read the value for this element, or add this selector to the\n` +
      `    fact's "scope" if it genuinely shares it.`,
    );
  }
  // --- legs 2 and 3: the CSS itself -------------------------------------
  for (const f of cssFiles(pkg)) {
    const file = path.join(pkg, f);
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');

    // Track whether we are inside a /* */ block. The old check only skipped a
    // line that STARTS with a comment marker, so the second and later lines of
    // a block comment were scanned as CSS — writing "the 220px case" in prose
    // failed the gate for a value the file does not use. False positives, not
    // misses, but they teach agents to delete the explanation rather than the
    // value, which is backwards.
    let inBlock = false;
    const nextSelector = selectorTracker();

    lines.forEach((line, n) => {
      const { code, stillInBlock } = stripComments(line, inBlock);
      inBlock = stillInBlock;
      if (!code.trim()) return; // nothing but comment/whitespace on this line
      line = code;
      // Feed the tracker the comment-stripped line, so a selector mentioned
      // in prose cannot be mistaken for a real rule.
      const selector = nextSelector(line);

      for (const m of line.matchAll(COLOUR_RE)) {
        errors.push(
          `${name}/${f}:${n + 1}: colour literal \`${m[0]}\`.\n` +
          `    Colours come from src/ui-theme as --t-* variables and are exact by\n` +
          `    construction. A hand-picked hex is how three GitHub colours once\n` +
          `    shipped as "Linear's palette".`,
        );
      }

      for (const m of line.matchAll(VALUE_RE)) {
        const v = m[0];
        if (FREE.has(v)) continue;
        if (!declared.has(v)) {
          errors.push(
            `${name}/${f}:${n + 1}: \`${v}\` is not in ui-facts.json.\n` +
            `    Either cite it (read it out of the corpus: bash pipeline/sx.sh <class>)\n` +
            `    or delete the property. An uncited value is a guess.`,
          );
          continue;
        }
        checkScope(name, f, n, v, selector);
      }
    });
  }
}

if (!checked) {
  console.log('ui-facts: no UI packages found — nothing to check.');
  process.exit(0);
}

for (const w of warnings) console.log(`ui-facts: WARN ${w}`);

if (errors.length) {
  console.error(`\nui-facts: FAIL — ${errors.length} problem(s) across ${checked} UI package(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}\n`);
  console.error('docs/UI-EXACTNESS.md explains the procedure. Every value is one grep away.\n');
  process.exit(1);
}

console.log(`ui-facts: OK — ${checked} UI package(s); every value declared and cited.`);
