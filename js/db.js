import { CONFIG } from './config.js';

let _db = null;

/**
 * IndexedDB wrapper with support for:
 * - Data stores per table (keyPath: 'id')
 * - sync_queue: ordered mutation queue with auto-increment
 * - sync_cursors: per-table last_sync_at timestamps for delta fetching
 */
export const DB = {
  async open() {
    if (_db) return _db;
    return new Promise((res, rej) => {
      const r = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        // Data stores
        CONFIG.TABLES.forEach(t => {
          if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
        });
        // Mutation queue
        if (!db.objectStoreNames.contains('sync_queue'))
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        // Delta sync cursors
        if (!db.objectStoreNames.contains('sync_cursors'))
          db.createObjectStore('sync_cursors', { keyPath: 'table' });
      };
      r.onsuccess = e => { _db = e.target.result; res(_db); };
      r.onerror = e => rej(e.target.error);
    });
  },

  // ─── DATA OPERATIONS ───────────────────────────────────────
  async getAll(t) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const r = db.transaction(t, 'readonly').objectStore(t).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
  },

  async get(t, id) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const r = db.transaction(t, 'readonly').objectStore(t).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  },

  async put(t, d) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(t, 'readwrite');
      tx.objectStore(t).put(d);
      tx.oncomplete = () => res(d);
      tx.onerror = () => rej(tx.error);
    });
  },

  async putAll(t, items) {
    if (!items.length) return;
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(t, 'readwrite');
      const s = tx.objectStore(t);
      items.forEach(i => s.put(i));
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async delete(t, id) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(t, 'readwrite');
      tx.objectStore(t).delete(id);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async clear(t) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction(t, 'readwrite');
      tx.objectStore(t).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  // ─── SYNC QUEUE ────────────────────────────────────────────
  async addToQueue(op) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add({
        ...op,
        timestamp: Date.now(),
        retries: 0
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async getQueue() {
    return this.getAll('sync_queue');
  },

  async clearQueue() {
    return this.clear('sync_queue');
  },

  async removeFromQueue(id) {
    return this.delete('sync_queue', id);
  },

  async updateQueueItem(item) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').put(item);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  // ─── DELTA SYNC CURSORS ────────────────────────────────────
  async getCursor(table) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const r = db.transaction('sync_cursors', 'readonly').objectStore('sync_cursors').get(table);
      r.onsuccess = () => res(r.result?.last_sync_at || null);
      r.onerror = () => rej(r.error);
    });
  },

  async setCursor(table, timestamp) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const tx = db.transaction('sync_cursors', 'readwrite');
      tx.objectStore('sync_cursors').put({ table, last_sync_at: timestamp });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },

  async clearAllCursors() {
    return this.clear('sync_cursors');
  }
};
