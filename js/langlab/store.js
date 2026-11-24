// Texts the person chose to keep in Murmur for the language mirror. They live in their own
// IndexedDB database on this device ("murmur-langlab"), apart from the voice journal, and are
// only written when the person presses "keep". Nothing here is sent anywhere.

const DB = 'murmur-langlab';
const STORE = 'texts';

function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'));
    const timer = setTimeout(() => reject(new Error('timeout')), 4000);
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => {
      clearTimeout(timer);
      resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error);
    };
    req.onblocked = () => {
      clearTimeout(timer);
      reject(new Error('blocked'));
    };
  });
}

async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      let result;
      if (req) req.onsuccess = () => (result = req.result);
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

// record: { id, createdAt, label, items: [{ text, timestamp, source }] }
export function keepTexts(record) {
  return run('readwrite', (s) => s.put(record));
}

export async function listKept() {
  const all = (await run('readonly', (s) => s.getAll())) || [];
  return all.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.items)).sort((a, b) => a.createdAt - b.createdAt);
}

export function deleteKept(id) {
  return run('readwrite', (s) => s.delete(id));
}

// For the app's "delete everything" action.
export function clearLanguageData() {
  return run('readwrite', (s) => s.clear());
}
