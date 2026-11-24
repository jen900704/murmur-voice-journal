// Offline support. Network first, so a new release reaches people on the next load;
// the cache is used only when the network is unavailable.
const CACHE = 'murmur-v2';
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
  './fonts/bricolage-grotesque-latin-wght-normal.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
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
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        // only page navigations fall back to the app shell
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      })
  );
});
