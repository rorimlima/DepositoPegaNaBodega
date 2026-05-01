import { CONFIG } from './config.js';
let _db = null;
export const DB = {
  async open() {
    if (_db) return _db;
    return new Promise((res, rej) => {
      const r = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        CONFIG.TABLES.forEach(t => { if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' }); });
        if (!db.objectStoreNames.contains('sync_queue')) db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = e => { _db = e.target.result; res(_db); };
      r.onerror = e => rej(e.target.error);
    });
  },
  async getAll(t) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction(t, 'readonly').objectStore(t).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); },
  async get(t, id) { const db = await this.open(); return new Promise((res, rej) => { const r = db.transaction(t, 'readonly').objectStore(t).get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); },
  async put(t, d) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).put(d); tx.oncomplete = () => res(d); tx.onerror = () => rej(tx.error); }); },
  async putAll(t, items) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction(t, 'readwrite'); const s = tx.objectStore(t); items.forEach(i => s.put(i)); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async delete(t, id) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).delete(id); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async clear(t) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction(t, 'readwrite'); tx.objectStore(t).clear(); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async addToQueue(op) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('sync_queue', 'readwrite'); tx.objectStore('sync_queue').add({ ...op, timestamp: Date.now() }); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); },
  async getQueue() { return this.getAll('sync_queue'); },
  async clearQueue() { return this.clear('sync_queue'); },
  async removeFromQueue(id) { return this.delete('sync_queue', id); }
};
