// IndexedDB storage. Everything stays in this browser on this device.
const DB_NAME = 'murmur';
const DB_VERSION = 2;

let dbPromise;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      if (!db.objectStoreNames.contains('lensSessions')) db.createObjectStore('lensSessions', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        let result;
        Promise.resolve(fn(t)).then((r) => (result = r));
        t.oncomplete = () => resolve(result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function req2p(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Audio is stored as an ArrayBuffer plus its type, which Safari handles more reliably
// than Blobs in IndexedDB.
export async function saveEntry(entry, audioBlob) {
  const audio = audioBlob ? { type: audioBlob.type, buf: await audioBlob.arrayBuffer() } : null;
  await tx(['entries', 'audio'], 'readwrite', (t) => {
    t.objectStore('entries').put(entry);
    if (audio) t.objectStore('audio').put(audio, entry.id);
  });
  return entry;
}

export async function updateEntry(entry) {
  await tx('entries', 'readwrite', (t) => t.objectStore('entries').put(entry));
}

export async function listEntries() {
  const db = await open();
  const all = await req2p(db.transaction('entries').objectStore('entries').getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getAudio(id) {
  const db = await open();
  const v = await req2p(db.transaction('audio').objectStore('audio').get(id));
  if (!v) return null;
  if (v instanceof Blob) return v;
  return new Blob([v.buf], { type: v.type || 'audio/webm' });
}

export async function deleteEntry(id) {
  await tx(['entries', 'audio'], 'readwrite', (t) => {
    t.objectStore('entries').delete(id);
    t.objectStore('audio').delete(id);
  });
}

export async function deleteAudio(id) {
  await tx('audio', 'readwrite', (t) => t.objectStore('audio').delete(id));
}

export async function clearAll() {
  await tx(['entries', 'audio', 'lensSessions', 'settings'], 'readwrite', (t) => {
    t.objectStore('entries').clear();
    t.objectStore('audio').clear();
    t.objectStore('lensSessions').clear();
    t.objectStore('settings').delete('lensStats');
  });
}

// Theory-lens exercises the person chose to save. Kept apart from voice entries and
// never used in voice baselines, trends, or correlations.
export async function saveLensSession(session) {
  await tx('lensSessions', 'readwrite', (t) => t.objectStore('lensSessions').put(session));
}

export async function listLensSessions() {
  const db = await open();
  const all = await req2p(db.transaction('lensSessions').objectStore('lensSessions').getAll());
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteLensSession(id) {
  await tx('lensSessions', 'readwrite', (t) => t.objectStore('lensSessions').delete(id));
}

export async function getSetting(key, fallback) {
  const db = await open();
  const v = await req2p(db.transaction('settings').objectStore('settings').get(key));
  return v === undefined ? fallback : v;
}

export async function setSetting(key, value) {
  await tx('settings', 'readwrite', (t) => t.objectStore('settings').put(value, key));
}

export async function importEntries(entries) {
  let added = 0;
  const existing = new Set((await listEntries()).map((e) => e.id));
  await tx('entries', 'readwrite', (t) => {
    const s = t.objectStore('entries');
    for (const e of entries) {
      if (!e || typeof e.id !== 'string' || !Number.isFinite(e.createdAt) || !e.features) continue;
      if (existing.has(e.id)) continue;
      s.put(e);
      added++;
    }
  });
  return added;
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
  } catch (_) {
    /* not supported */
  }
  return false;
}
