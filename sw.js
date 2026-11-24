// Offline support. Network first, so a new release reaches people on the next load;
// the cache is used only when the network is unavailable.
const CACHE = 'murmur-v6';
const NETWORK_TIMEOUT_MS = 3000;
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
  const network = fetch(req);
  // refresh the cache whenever the network answers, even if it was too slow to use this time
  e.waitUntil(
    network
      .then((res) => {
        if (res && res.ok) return caches.open(CACHE).then((c) => c.put(req, res.clone()));
      })
      .catch(() => {})
  );
  // a slow connection should not leave the app hanging: use the cache after 3 s
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT_MS));
  e.respondWith(
    Promise.race([network, timeout])
      .then((res) => res.clone())
      .catch(async () => {
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const shell = await caches.match('./index.html');
          if (shell) return shell;
        }
        // nothing cached: keep waiting for the network
        return network.then((res) => res.clone());
      })
  );
});
