#!/usr/bin/env node
/**
 * ui-facts: the corpus-free UI exactness checker.
 *
 * It answers the one question a reviewer cannot answer from a screenshot:
 * is every value in this UI traceable to something someone actually read?
 *
 * Fast on purpose — pure file reads, no corpus, no network, no toolchain — so
 * it can be a REQUIRED check on every PR rather than something a reviewer
 * runs sometimes.
 *
 * Legs:
 *   1. every UI package declares ui-facts.json
 *   2. no colour literals in UI source (colours come from the theme generator)
 *   3. every dimensional value in the CSS appears in ui-facts.json
 *   4. every fact carries a citation
 *
 * Leg 3 is the one that catches invention: an agent working from memory writes
 * numbers it cannot cite, and this finds them without needing to know the
 * right answer itself.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] ?? '.';
const errors = [];
let checked = 0;

/** A UI package is any src/* dir holding a file that emits CSS. */
function uiPackages() {
  const src = path.join(ROOT, 'src');
  if (!fs.existsSync(src)) return [];
  return fs.readdirSync(src)
    .map((d) => path.join(src, d))
    .filter((d) => fs.statSync(d).isDirectory())
    .filter((d) => fs.readdirSync(d).some((f) => /\.css\.ts$|\.css$/.test(f)));
}

/** Values whose exactness is visible: lengths, not counts or keywords. */
const VALUE_RE = /(-?\d*\.?\d+)(px|rem|em|ch|vh|vw|%)/g;

/**
 * Values carrying no design information, where citing would be pure noise.
 * Deliberately tiny: 0 is 0 in every design system, and 1px/100% are
 * structural rather than chosen. Everything else must be read.
 */
const FREE = new Set(['0px', '0rem', '0%', '0em', '1px', '100%', '100vh', '100vw']);

const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/g;

for (const pkg of uiPackages()) {
  checked++;
  const name = path.relative(ROOT, pkg);
  const factsPath = path.join(pkg, 'ui-facts.json');

  // --- leg 1: the package declares its facts at all ----------------------
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

  // --- leg 4: every fact carries a citation ------------------------------
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
        `    Name the file + class/identifier you read it at, or mark it\n` +
        `    UNVERIFIED and leave the property out of the CSS.`,
      );
    }
    // An UNVERIFIED fact does NOT license its value for use.
    if (!unverified) for (const m of String(r.value).matchAll(VALUE_RE)) declared.add(m[0]);
  }

  // --- legs 2 and 3: the CSS itself --------------------------------------
  for (const f of fs.readdirSync(pkg).filter((f) => /\.css\.ts$|\.css$/.test(f))) {
    const text = fs.readFileSync(path.join(pkg, f), 'utf8');

    text.split('\n').forEach((line, n) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return; // comments are prose

      for (const m of line.matchAll(COLOUR_RE)) {
        errors.push(
          `${name}/${f}:${n + 1}: colour literal \`${m[0]}\`.\n` +
          `    Colours come from src/ui-theme as --t-* variables, exact by\n` +
          `    construction. A hand-picked hex is how three GitHub colours\n` +
          `    once shipped as "Linear's palette".`,
        );
      }

      for (const m of line.matchAll(VALUE_RE)) {
        const v = m[0];
        if (FREE.has(v) || declared.has(v)) continue;
        errors.push(
          `${name}/${f}:${n + 1}: \`${v}\` is not in ui-facts.json.\n` +
          `    Cite it (read it: bash pipeline/sx.sh <class>) or delete the\n` +
          `    property. An uncited value is a guess.`,
        );
      }
    });
  }
}

if (!checked) {
  console.log('ui-facts: no UI packages found — nothing to check.');
  process.exit(0);
}

if (errors.length) {
  console.error(`\nui-facts: FAIL — ${errors.length} problem(s) across ${checked} UI package(s):\n`);
  for (const e of errors) console.error(`  ✗ ${e}\n`);
  console.error('docs/UI-EXACTNESS.md has the procedure. Every value is one grep away.\n');
  process.exit(1);
}

console.log(`ui-facts: OK — ${checked} UI package(s); every value declared and cited.`);
