/**
 * Build the executable pretty corpus.
 *
 * js-beautify is a readability aid, not a compiler. Its output must parse
 * before it becomes a corpus artifact: when it does not, preserve the raw
 * source verbatim so every file the execution harness sees is valid ESM.
 */
import { parse, tokenizer } from 'acorn';
import pkg from 'js-beautify';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { js } = pkg;
export const DEFAULT_OPTIONS = {
  indent_size: 2,
  max_preserve_newlines: 2,
  space_before_conditional: true,
  unescape_strings: false,
};

const PARSE_OPTIONS = { ecmaVersion: `latest`, sourceType: `module`, allowHashBang: true };

function parseModule(source, filename) {
  parse(source, PARSE_OPTIONS);
  return filename;
}

/**
 * Signature only the token stream that js-beautify has demonstrably damaged:
 * template delimiters, quasi source bytes, and interpolation boundaries. This
 * is intentionally narrower than semantic equivalence of arbitrary JavaScript.
 */
function templateSignature(source) {
  const tokens = [];
  for (const token of tokenizer(source, PARSE_OPTIONS)) {
    if (token.type.label === '`' || token.type.label === `template` || token.type.label === '${') {
      tokens.push([token.type.label, source.slice(token.start, token.end)]);
    }
  }
  return JSON.stringify(tokens);
}

function validatePrettyCandidate(rawSource, candidate, filename) {
  parseModule(candidate, `${filename} (prettifier output)`);
  if (templateSignature(rawSource) !== templateSignature(candidate)) {
    throw new Error(`template token signature differs from raw source`);
  }
}

function jsFiles(dir) {
  return fs.readdirSync(dir).filter((file) => file.endsWith(`.js`)).sort();
}

function writeAtomically(filename, content) {
  const temporary = `${filename}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, filename);
  } catch (error) {
    // Cleanup must not mask the original write/rename failure.
    try { fs.rmSync(temporary, { force: true }); } catch { /* best effort */ }
    throw error;
  }
}

/**
 * Beautify every raw client chunk, using the raw bytes when prettifier output
 * fails the ESM parse gate. Returns names as well as counts so a refresh log
 * can identify exactly which chunks were preserved raw.
 */
export function prettifyDirectory({ src = `client`, out = `pretty/client`, beautify = js } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const files = jsFiles(src);
  const result = { total: files.length, prettified: [], rawFallback: [], failed: [], staleRemoved: [] };
  const sourceFiles = new Set(files);
  for (const file of jsFiles(out)) {
    if (!sourceFiles.has(file)) {
      try {
        fs.rmSync(path.join(out, file));
        result.staleRemoved.push(file);
      } catch (error) {
        result.failed.push({ file, reason: `could not remove stale output: ${String(error.message ?? error)}` });
      }
    }
  }

  for (const file of files) {
    const sourcePath = path.join(src, file);
    const outputPath = path.join(out, file);
    try {
      // Retain the exact captured bytes for a fallback. Parsing and
      // beautification consume UTF-8 text, but raw fallback never round-trips
      // through a decoded string.
      const raw = fs.readFileSync(sourcePath);
      const source = raw.toString(`utf8`);
      // A corrupt upstream/raw cache must fail loudly; falling back cannot make
      // an invalid source executable.
      parseModule(source, sourcePath);

      let output = raw;
      let fallbackReason;
      try {
        const candidate = beautify(source, DEFAULT_OPTIONS);
        validatePrettyCandidate(source, candidate, file);
        output = candidate;
      } catch (error) {
        // The raw source already parsed above, so this fallback is both
        // executable and byte-faithful. Do not attempt source "repairs" here.
        fallbackReason = String(error.message ?? error);
      }
      writeAtomically(outputPath, output);
      if (fallbackReason === undefined) result.prettified.push(file);
      else result.rawFallback.push({ file, reason: fallbackReason });
    } catch (error) {
      // Never retain a stale output for a source we could not validate. A
      // cleanup failure must not hide the original parse/write failure.
      try { fs.rmSync(outputPath, { force: true }); } catch { /* best effort */ }
      result.failed.push({ file, reason: String(error.message ?? error) });
    }
  }
  return result;
}

/** Validate the cached output before analysis or corpus execution uses it. */
export function checkPrettyDirectory({ src = `client`, out = `pretty/client` } = {}) {
  const files = jsFiles(src);
  const result = { total: files.length, valid: [], invalid: [] };
  for (const file of files) {
    const outputPath = path.join(out, file);
    try {
      const raw = fs.readFileSync(path.join(src, file), `utf8`);
      parseModule(raw, path.join(src, file));
      const output = fs.readFileSync(outputPath, `utf8`);
      validatePrettyCandidate(raw, output, outputPath);
      result.valid.push(file);
    } catch (error) {
      result.invalid.push({ file, reason: String(error.message ?? error) });
    }
  }
  return result;
}

function reportBuild(result) {
  console.log(`prettified ${result.prettified.length}/${result.total}, raw-fallback ${result.rawFallback.length}, stale-removed ${result.staleRemoved.length}, failed ${result.failed.length}`);
  if (result.staleRemoved.length) console.log(`stale removed: ${result.staleRemoved.join(`, `)}`);
  if (result.rawFallback.length) console.log(`raw fallback: ${result.rawFallback.map(({ file }) => file).join(`, `)}`);
  if (result.failed.length) console.error(`failed: ${result.failed.map(({ file }) => file).join(`, `)}`);
}

function reportCheck(result) {
  console.log(`pretty parse check ${result.valid.length}/${result.total}, invalid ${result.invalid.length}`);
  if (result.invalid.length) console.error(`invalid: ${result.invalid.map(({ file }) => file).join(`, `)}`);
}

function isCli() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isCli()) {
  const checkOnly = process.argv.slice(2).includes(`--check`);
  const result = checkOnly ? checkPrettyDirectory() : prettifyDirectory();
  if (checkOnly) reportCheck(result);
  else reportBuild(result);
  if ((checkOnly ? result.invalid : result.failed).length) process.exitCode = 1;
}
