// Offline support. The cache name is set by tools/bump-cache.mjs (npm run prepare-release).
// Every release installs its files into one versioned cache, and pages
// are served from that cache, so a page never runs files from two different releases.
const CACHE = 'murmur-5d0a658708';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/features.js',
  './js/stats.js',
  './js/viz.js',
  './js/db.js',
  './js/i18n.js',
  './js/recorder.js',
  './js/worker.js',
  './js/lenses.js',
  './js/lens-view.js',
  './js/safety.js',
  './js/bedtime.js',
  './js/postcard.js',
  './js/night-view.js',
  './js/extras.js',
  './js/prompts.js',
  './js/ai-chat.js',
  './js/ai-models.js',
  './js/breathe.js',
  './js/validate.js',
  './js/policy.js',
  './js/search.js',
  './js/rag.js',
  './js/flow-history.js',
  './js/voice-report.js',
  './js/langlab/zh-s2t.js',
  './js/calm.js',
  './js/writing.js',
  './js/language-view.js',
  './js/langlab/importers.js',
  './js/langlab/lexicon-en.js',
  './js/langlab/lexicon-zh.js',
  './js/langlab/meta.js',
  './js/langlab/report.js',
  './js/langlab/score.js',
  './js/langlab/store.js',
  './js/langlab/tokenize.js',
  './js/langlab/vader.js',
  './js/langlab/zip.js',
  './data/lexica/vader.json',
  './data/lexica/NOTICE.txt',
  './css/calm.css',
  './css/language.css',
  './css/writing.css',
  './data/recs.json',
  './fonts/bricolage-grotesque-latin-wght-normal.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/og.png',
  './manifest.webmanifest',
  './demo/demo-data.json',
];

self.addEventListener('install', (e) => {
  // Fetch each file with the cache name as a query, so a CDN edge cannot hand back a copy
  // from an older release; store it under its plain URL. Any failure fails the install.
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(
        SHELL.map(async (u) => {
          const bust = u === './' ? `./?v=${CACHE}` : `${u}?v=${CACHE}`;
          const res = await fetch(bust, { cache: 'reload' });
          if (!res.ok) throw new Error(`${u}: ${res.status}`);
          await c.put(u, res);
        })
      )
    )
  );
});

// The page asks for this when it is idle (just reopened, nothing typed or playing), then reloads.
self.addEventListener('message', (e) => {
  if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('murmur-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/sw.js')) return;
  // Cache first, from the cache this version installed as a whole. A new release waits until
  // the page is idle and asks for it, then the page reloads, so two releases never mix.
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      try {
        const res = await fetch(req);
        if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
        return res;
      } catch (err) {
        // offline and this file was never cached (for example, the phone cleared storage)
        if (req.mode !== 'navigate') throw err;
        return new Response(
          '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Murmur</title><body style="font:16px/1.6 system-ui;padding:2em;max-width:34em">Murmur 需要連上網路一次才能離線使用。請連線後重新整理。<br>Murmur needs to go online once before it works offline. Please reconnect and reload.<p>需要協助：台灣 1925 · US 988</p></body>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })
  );
});
