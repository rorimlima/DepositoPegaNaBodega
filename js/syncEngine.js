// ========== Sync Engine ==========
const SyncEngine = {
  _interval: null,
  _syncing: false,
  online: navigator.onLine,

  init() {
    window.addEventListener('online', () => { this.online = true; this.updateUI(); });
    window.addEventListener('offline', () => { this.online = false; this.updateUI(); });
    this.updateUI();
    this.startAutoSync();
  },

  startAutoSync() {
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(() => this.sync(), CONFIG.SYNC_INTERVAL);
  },

  updateUI() {
    const dot = document.getElementById('sync-dot');
    const label = document.getElementById('sync-label');
    if (this._syncing) {
      dot.className = 'sync-dot syncing'; label.textContent = 'Sincronizando...';
    } else if (this.online) {
      dot.className = 'sync-dot online'; label.textContent = 'Online';
    } else {
      dot.className = 'sync-dot offline'; label.textContent = 'Offline';
    }
  },

  async updateBadge() {
    const queue = await DB.getQueue();
    const badge = document.getElementById('sync-badge');
    if (queue.length > 0) {
      badge.style.display = 'flex'; badge.textContent = queue.length;
    } else {
      badge.style.display = 'none';
    }
  },

  async sync() {
    if (this._syncing || !this.online) return;
    this._syncing = true;
    this.updateUI();
    const btn = document.getElementById('btn-sync');
    btn.classList.add('syncing');

    try {
      // Process sync queue
      const queue = await DB.getQueue();
      for (const op of queue) {
        try {
          await this._processOp(op);
          await DB.removeFromQueue(op.id);
        } catch (err) {
          console.error('Sync op failed:', op, err);
        }
      }

      // Pull fresh data from Supabase
      await this._pullAll();

      if (queue.length > 0) Toast.success(`${queue.length} operação(ões) sincronizada(s)`);
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      this._syncing = false;
      this.updateUI();
      this.updateBadge();
      btn.classList.remove('syncing');
    }
  },

  async _processOp(op) {
    const { table, type, data } = op;
    if (type === 'insert') {
      const { error } = await supabase.from(table).upsert(data);
      if (error) throw error;
    } else if (type === 'update') {
      const { error } = await supabase.from(table).upsert(data);
      if (error) throw error;
    } else if (type === 'delete') {
      const { error } = await supabase.from(table).delete().eq('id', data.id);
      if (error) throw error;
    }
  },

  async _pullAll() {
    for (const table of CONFIG.TABLES) {
      try {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          await DB.clear(table);
          await DB.putAll(table, data);
        }
      } catch (e) { console.error(`Pull ${table} failed`, e); }
    }
  },

  // Convenience methods for CRUD with offline queue
  async insert(table, data) {
    await DB.put(table, data);
    await DB.addToQueue({ table, type: 'insert', data });
    this.updateBadge();
  },

  async update(table, data) {
    await DB.put(table, data);
    await DB.addToQueue({ table, type: 'update', data });
    this.updateBadge();
  },

  async remove(table, id) {
    await DB.delete(table, id);
    await DB.addToQueue({ table, type: 'delete', data: { id } });
    this.updateBadge();
  }
};
