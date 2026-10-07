// Browser-only storage using IndexedDB. Videos never leave the device, which
// makes this ideal for trying the site out before a shared backend exists.

const DB_NAME = 'generations';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('videos')) {
        const s = db.createObjectStore('videos', { keyPath: 'id' });
        s.createIndex('memberId', 'memberId');
      }
      if (!db.objectStoreNames.contains('members')) {
        db.createObjectStore('members', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db, store, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((r) => { result = r; });
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Storage was blocked or is full.'));
  });
}

const asPromise = (req) => new Promise((res, rej) => {
  req.onsuccess = () => res(req.result);
  req.onerror = () => rej(req.error);
});

// Object URLs are cached per record so re-renders don't leak memory.
const urlCache = new Map();
function blobUrl(key, blob) {
  if (!blob) return '';
  if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(blob));
  return urlCache.get(key);
}
function dropUrl(key) {
  if (urlCache.has(key)) { URL.revokeObjectURL(urlCache.get(key)); urlCache.delete(key); }
}

export function createLocalStore(config) {
  let db;

  const toVideo = (r) => ({
    id: r.id,
    memberId: r.memberId,
    title: r.title,
    description: r.description,
    recordedOn: r.recordedOn,
    createdAt: r.createdAt,
    duration: r.duration,
    uploadedBy: r.uploadedBy,
    link: r.link || '',
    url: blobUrl(`v:${r.id}`, r.blob),
    thumbUrl: blobUrl(`t:${r.id}`, r.thumb),
  });

  return {
    mode: 'local',
    maxUploadMB: config.maxUploadMB,

    async init() {
      db = await openDb();
      // Ask the browser not to evict our data under storage pressure.
      try { await navigator.storage?.persist?.(); } catch { /* optional */ }
    },

    needsSignIn: () => false,
    user: () => null,
    async signIn() {},
    async signOut() {},

    async memberOverrides() {
      const rows = await tx(db, 'members', 'readonly', (s) => asPromise(s.getAll()));
      const map = {};
      for (const r of rows) {
        const { photo, ...rest } = r;
        map[r.id] = { ...rest, photoUrl: blobUrl(`p:${r.id}`, photo) };
      }
      return map;
    },

    async updateMember(memberId, patch, photoFile) {
      await tx(db, 'members', 'readwrite', async (s) => {
        const existing = (await asPromise(s.get(memberId))) || { id: memberId };
        const next = { ...existing, ...patch, id: memberId };
        if (photoFile) { next.photo = photoFile; dropUrl(`p:${memberId}`); }
        s.put(next);
      });
    },

    async videoCounts() {
      const rows = await tx(db, 'videos', 'readonly', (s) => {
        const counts = {};
        return new Promise((res) => {
          const cur = s.index('memberId').openKeyCursor();
          cur.onsuccess = () => {
            const c = cur.result;
            if (!c) return res(counts);
            counts[c.key] = (counts[c.key] || 0) + 1;
            c.continue();
          };
        });
      });
      return rows;
    },

    async listVideos(memberId) {
      const rows = await tx(db, 'videos', 'readonly', (s) => asPromise(s.index('memberId').getAll(memberId)));
      return rows.map(toVideo).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    },

    async uploadVideo(memberId, file, meta, thumb, onProgress) {
      onProgress?.(0.15);
      const record = {
        id: crypto.randomUUID(),
        memberId,
        title: meta.title,
        description: meta.description,
        recordedOn: meta.recordedOn,
        duration: meta.duration,
        uploadedBy: meta.uploadedBy,
        createdAt: new Date().toISOString(),
        link: meta.link || '',
        blob: file || null,
        thumb,
      };
      await tx(db, 'videos', 'readwrite', (s) => s.put(record));
      onProgress?.(1);
      return toVideo(record);
    },

    async updateVideo(id, patch) {
      await tx(db, 'videos', 'readwrite', async (s) => {
        const r = await asPromise(s.get(id));
        if (r) s.put({ ...r, ...patch });
      });
    },

    async deleteVideo(id) {
      await tx(db, 'videos', 'readwrite', (s) => s.delete(id));
      dropUrl(`v:${id}`); dropUrl(`t:${id}`);
    },
  };
}
