// Offline support. Every release installs its files into one versioned cache, and pages
// are served from that cache, so a page never runs files from two different releases.
const CACHE = 'murmur-v13';
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
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Cache first, from the cache this version installed as a whole. Mixing files from two
  // releases (new app.js with an old module) can break imports, so a new release is picked
  // up when its service worker installs, and used from the next launch.
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      if (req.mode === 'navigate') {
        const shell = await cache.match('./index.html');
        if (shell) return shell;
      }
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
  );
});
