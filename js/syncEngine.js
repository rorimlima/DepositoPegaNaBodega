import { CONFIG } from './config.js';
import { DB } from './db.js';
import { supabase } from './supabaseClient.js';
import { Toast } from './toast.js';

let _syncing = false;
let _interval = null;

export const SyncEngine = {
  online: navigator.onLine,
  init() {
    window.addEventListener('online', () => { this.online = true; this.updateUI(); });
    window.addEventListener('offline', () => { this.online = false; this.updateUI(); });
    this.updateUI();
    _interval = setInterval(() => this.sync(), CONFIG.SYNC_INTERVAL);
  },
  updateUI() {
    const dot = document.getElementById('sync-dot'), lbl = document.getElementById('sync-label');
    if (_syncing) { dot.className = 'sync-dot syncing'; lbl.textContent = 'Sincronizando...'; }
    else if (this.online) { dot.className = 'sync-dot online'; lbl.textContent = 'Online'; }
    else { dot.className = 'sync-dot offline'; lbl.textContent = 'Offline'; }
  },
  async updateBadge() {
    const q = await DB.getQueue(), b = document.getElementById('sync-badge');
    if (q.length > 0) { b.style.display = 'flex'; b.textContent = q.length; } else b.style.display = 'none';
  },
  async sync() {
    if (_syncing || !this.online) return;
    _syncing = true; this.updateUI();
    const btn = document.getElementById('btn-sync'); btn.classList.add('syncing');
    try {
      const queue = await DB.getQueue();
      for (const op of queue) {
        try {
          const { table, type, data } = op;
          if (type === 'delete') { await supabase.from(table).delete().eq('id', data.id); }
          else { await supabase.from(table).upsert(data); }
          await DB.removeFromQueue(op.id);
        } catch(e) { console.error('Sync op fail:', e); }
      }
      await this.pullAll();
      if (queue.length > 0) Toast.success(`${queue.length} operação(ões) sincronizada(s)`);
    } catch(e) { console.error('Sync error:', e); }
    finally { _syncing = false; this.updateUI(); this.updateBadge(); btn.classList.remove('syncing'); }
  },
  async pullAll() {
    for (const t of CONFIG.TABLES) {
      try { const { data, error } = await supabase.from(t).select('*'); if (!error && data) { await DB.clear(t); await DB.putAll(t, data); } } catch(e) {}
    }
  },
  async insert(t, d) { await DB.put(t, d); await DB.addToQueue({ table:t, type:'insert', data:d }); this.updateBadge(); },
  async update(t, d) { await DB.put(t, d); await DB.addToQueue({ table:t, type:'update', data:d }); this.updateBadge(); },
  async remove(t, id) { await DB.delete(t, id); await DB.addToQueue({ table:t, type:'delete', data:{id} }); this.updateBadge(); }
};
