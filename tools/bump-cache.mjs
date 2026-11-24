// The service worker serves one release's files from one cache, and browsers only install a
// new worker when sw.js changes. So the cache name is a hash of every cached file: any change
// to the app gives a new name. Run: node tools/bump-cache.mjs (a unit test checks it was run).
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const SW = new URL('sw.js', root);

export function shellFiles(swText) {
  const list = swText.slice(swText.indexOf('const SHELL = ['), swText.indexOf('];', swText.indexOf('const SHELL = [')));
  return [...list.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter((f) => f && !f.endsWith('/'));
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
  writeFileSync(SW, sw.replace(/const CACHE = '[^']*';/, `const CACHE = '${name}';`));
  console.log(name);
}
