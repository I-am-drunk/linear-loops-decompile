import pkg from 'js-beautify';
const { js } = pkg;
import fs from 'fs';
import path from 'path';
import os from 'os';

const SRC = 'client';
const OUT = 'pretty/client';
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter(f => f.endsWith('.js'));
let done = 0, failed = [];
const opts = { indent_size: 2, max_preserve_newlines: 2, space_before_conditional: true, unescape_strings: false };

for (const f of files) {
  try {
    const code = fs.readFileSync(path.join(SRC, f), 'utf8');
    const out = js(code, opts);
    fs.writeFileSync(path.join(OUT, f), out);
    done++;
  } catch (e) { failed.push(f); }
}
console.log(`prettified ${done}/${files.length}, failed: ${failed.length}`);
if (failed.length) console.log(failed.slice(0, 10));
