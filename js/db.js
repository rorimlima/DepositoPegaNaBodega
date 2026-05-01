// ========== IndexedDB Wrapper ==========
const DB = {
  _db: null,

  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        CONFIG.TABLES.forEach(t => {
          if (!db.objectStoreNames.contains(t)) {
            db.createObjectStore(t, { keyPath: 'id' });
          }
        });
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(table) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, 'readonly');
      const store = tx.objectStore(table);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async get(table, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, 'readonly');
      const req = tx.objectStore(table).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  },

  async put(table, data) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, 'readwrite');
      tx.objectStore(table).put(data);
      tx.oncomplete = () => resolve(data);
      tx.onerror = () => reject(tx.error);
    });
  },

  async putAll(table, items) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, 'readwrite');
      const store = tx.objectStore(table);
      items.forEach(item => store.put(item));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async delete(table, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, 'readwrite');
      tx.objectStore(table).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async clear(table) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(table, 'readwrite');
      tx.objectStore(table).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async addToQueue(operation) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      tx.objectStore('sync_queue').add({ ...operation, timestamp: Date.now() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
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
  }
};
