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

const ROOT = process.argv[2] ?? '.';
const errors = [];
const warnings = [];
let checked = 0;

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

function cssFiles(dir) {
  return fs.readdirSync(dir).filter(
    (f) => SOURCE_RE.test(f) && !/\.test\.[a-z]+$/.test(f),
  );
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
    .filter((d) => fs.readdirSync(d).some(
      (f) => STYLESHEET_NAME_RE.test(f) && !/\.test\.[a-z]+$/.test(f),
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
  }

  // --- legs 2 and 3: the CSS itself -------------------------------------
  for (const f of cssFiles(pkg)) {
    const file = path.join(pkg, f);
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split('\n');

    lines.forEach((line, n) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments are prose

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
        if (FREE.has(v) || declared.has(v)) continue;
        errors.push(
          `${name}/${f}:${n + 1}: \`${v}\` is not in ui-facts.json.\n` +
          `    Either cite it (read it out of the corpus: bash pipeline/sx.sh <class>)\n` +
          `    or delete the property. An uncited value is a guess.`,
        );
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
