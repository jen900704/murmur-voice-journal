// The service worker serves one release's files from one cache, and browsers only install a
// new worker when sw.js changes. So the cache name is a hash of every cached file: any change
// to the app gives a new name. Run: node tools/bump-cache.mjs (a unit test checks it was run).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const SW = new URL('sw.js', root);

export function shellFiles(swText) {
  const start = swText.indexOf('const SHELL = [');
  if (start < 0) throw new Error('sw.js: SHELL list not found');
  const list = swText.slice(start, swText.indexOf('];', start));
  const files = [...list.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter((f) => f && !f.endsWith('/'));
  if (files.length < 25) throw new Error(`sw.js: only ${files.length} files found in SHELL`);
  return files;
}

export function expectedCache(swText) {
  const h = createHash('sha256');
  for (const f of shellFiles(swText)) {
    h.update(f);
    h.update(readFileSync(new URL(f, root)));
  }
  // sw.js itself, minus its own cache line
  h.update(swText.replace(/const CACHE = '[^']*';/, ''));
  return 'murmur-' + h.digest('hex').slice(0, 10);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const sw = readFileSync(SW, 'utf8');
  const name = expectedCache(sw);
  const next = sw.replace(/const CACHE = '[^']*';/, `const CACHE = '${name}';`);
  if (!/const CACHE = '[^']*';/.test(sw)) throw new Error('sw.js: CACHE line not found');
  writeFileSync(SW, next);
  console.log(name);
}
