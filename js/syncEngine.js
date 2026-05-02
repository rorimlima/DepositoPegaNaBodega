import { CONFIG } from './config.js';
import { DB } from './db.js';
import { supabase } from './supabaseClient.js';
import { Toast } from './toast.js';

/**
 * ═══════════════════════════════════════════════════════════════
 * SYNC ENGINE — AppSheet-grade offline-first synchronization
 * ═══════════════════════════════════════════════════════════════
 *
 * Architecture:
 * ┌──────────────┐   Optimistic Write   ┌──────────────┐
 * │     UI       │ ──────────────────── │  IndexedDB   │
 * │  (Instant)   │                      │  (Cache)     │
 * └──────┬───────┘                      └──────┬───────┘
 *        │                                     │
 *        │  Subscribe/Notify                   │ Queue
 *        ▼                                     ▼
 * ┌──────────────┐  Delta Fetch +      ┌──────────────┐
 * │  Realtime    │  Push Queue         │  Supabase    │
 * │  Channel     │ ◄─────────────────► │  PostgreSQL  │
 * └──────────────┘                     └──────────────┘
 *
 * Features:
 * 1. Optimistic UI — writes hit IndexedDB + UI immediately
 * 2. Background Mutation Queue — with exponential backoff
 * 3. Delta Sync — only fetches records where updated_at > cursor
 * 4. Supabase Realtime — debounced INSERT/UPDATE/DELETE events
 * 5. LWW Conflict Resolution — latest updated_at always wins
 * 6. Soft Deletes — is_deleted flag, never physical DELETE on server
 * 7. Passive sync indicator — never blocks UI
 */

// ─── INTERNAL STATE ─────────────────────────────────────────
let _syncing = false;
let _pushingQueue = false;
let _deltaInterval = null;
let _realtimeChannel = null;
let _realtimeDebounceTimers = {};
const _subscribers = new Set();    // UI change listeners
let _retryTimeout = null;

// ─── PUBLIC API ─────────────────────────────────────────────
export const SyncEngine = {
  online: navigator.onLine,

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LIFECYCLE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  init() {
    // Network status listeners
    window.addEventListener('online', () => {
      this.online = true;
      this._updateStatusUI();
      // When coming back online, push queue + delta sync immediately
      this._pushQueue();
      this._deltaSyncAll();
    });
    window.addEventListener('offline', () => {
      this.online = false;
      this._updateStatusUI();
    });

    this._updateStatusUI();

    // Start periodic delta sync
    _deltaInterval = setInterval(() => {
      if (this.online && !_syncing) this._deltaSyncAll();
    }, CONFIG.SYNC_INTERVAL);

    // Setup Supabase Realtime subscriptions
    this._setupRealtime();
  },

  /**
   * Force a full sync cycle: push queue → delta pull all tables
   * Triggered by the manual sync button
   */
  async sync() {
    if (_syncing || !this.online) return;
    _syncing = true;
    this._updateStatusUI();
    try {
      await this._pushQueue();
      await this._deltaSyncAll();
    } catch (e) {
      console.error('[SyncEngine] Full sync error:', e);
    } finally {
      _syncing = false;
      this._updateStatusUI();
      this._updateBadge();
    }
  },

  /**
   * Initial load: full fetch for first time, delta for subsequent
   */
  async initialLoad() {
    try {
      for (const table of CONFIG.TABLES) {
        const cursor = await DB.getCursor(table);
        if (!cursor) {
          // First time — full load
          await this._fullFetchTable(table);
        } else {
          // Has cursor — delta only
          await this._deltaSyncTable(table);
        }
      }
    } catch (e) {
      console.error('[SyncEngine] Initial load error:', e);
      // Graceful — app works offline from IndexedDB cache
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // OPTIMISTIC MUTATIONS — Zero UI blocking
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async insert(table, data) {
    // 1. Write to IndexedDB immediately (optimistic)
    await DB.put(table, data);
    // 2. Enqueue for background push to Supabase
    await DB.addToQueue({ table, type: 'upsert', data });
    // 3. Notify all UI subscribers
    this._notifySubscribers(table);
    this._updateBadge();
    // 4. Try to push immediately if online (non-blocking)
    if (this.online) this._pushQueue();
  },

  async update(table, data) {
    // Same as insert — upsert semantics
    await DB.put(table, data);
    await DB.addToQueue({ table, type: 'upsert', data });
    this._notifySubscribers(table);
    this._updateBadge();
    if (this.online) this._pushQueue();
  },

  async remove(table, id) {
    // 1. Get the record first to perform soft-delete
    const record = await DB.get(table, id);
    if (record) {
      // Soft delete: mark as deleted in local cache
      record.is_deleted = true;
      record.updated_at = new Date().toISOString();
      await DB.put(table, record);
      // Enqueue soft-delete to server
      await DB.addToQueue({
        table,
        type: 'soft_delete',
        data: { id, is_deleted: true, updated_at: record.updated_at }
      });
    } else {
      // Record doesn't exist locally, just enqueue
      await DB.addToQueue({
        table,
        type: 'soft_delete',
        data: { id, is_deleted: true, updated_at: new Date().toISOString() }
      });
    }
    this._notifySubscribers(table);
    this._updateBadge();
    if (this.online) this._pushQueue();
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DATA ACCESS — Read from IndexedDB (cache-first)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Get all active (non-deleted) records from a table
   */
  async getAll(table) {
    const all = await DB.getAll(table);
    return all.filter(r => !r.is_deleted);
  },

  /**
   * Get a single record by ID (returns null if soft-deleted)
   */
  async get(table, id) {
    const record = await DB.get(table, id);
    return (record && !record.is_deleted) ? record : null;
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBSCRIPTIONS — UI reactivity without render loops
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /**
   * Subscribe to changes on specific tables.
   * Returns an unsubscribe function.
   * @param {string[]} tables - Tables to watch
   * @param {Function} callback - Called with { table, source }
   */
  subscribe(tables, callback) {
    const sub = { tables, callback };
    _subscribers.add(sub);
    return () => _subscribers.delete(sub);
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // BACKGROUND MUTATION QUEUE — Exponential Backoff
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async _pushQueue() {
    if (_pushingQueue || !this.online) return;
    _pushingQueue = true;
    this._updateStatusUI('syncing');

    try {
      const queue = await DB.getQueue();
      if (queue.length === 0) {
        _pushingQueue = false;
        this._updateStatusUI();
        return;
      }

      let successCount = 0;
      for (const op of queue) {
        try {
          const { table, type, data } = op;
          let error;

          if (type === 'soft_delete') {
            // Soft delete: update is_deleted + updated_at on server
            const res = await supabase
              .from(table)
              .update({ is_deleted: true, updated_at: data.updated_at })
              .eq('id', data.id);
            error = res.error;
          } else {
            // Upsert (insert or update)
            const res = await supabase.from(table).upsert(data);
            error = res.error;
          }

          if (error) throw error;

          // Success — remove from queue
          await DB.removeFromQueue(op.id);
          successCount++;
        } catch (e) {
          console.warn(`[SyncEngine] Queue op failed (table: ${op.table}, retries: ${op.retries}):`, e.message);

          // Increment retries
          op.retries = (op.retries || 0) + 1;
          if (op.retries >= CONFIG.RETRY_MAX_ATTEMPTS) {
            // Dead letter — remove and warn
            console.error(`[SyncEngine] Max retries reached for op on ${op.table}, discarding:`, op);
            await DB.removeFromQueue(op.id);
            Toast.error(`Falha ao sincronizar ${op.table}. Operação descartada.`);
          } else {
            // Update retry count
            await DB.updateQueueItem(op);
            // Schedule retry with exponential backoff
            const delay = Math.min(
              CONFIG.RETRY_BASE_DELAY * Math.pow(2, op.retries),
              CONFIG.RETRY_MAX_DELAY
            );
            clearTimeout(_retryTimeout);
            _retryTimeout = setTimeout(() => this._pushQueue(), delay);
            break; // Stop processing queue — retry later
          }
        }
      }

      if (successCount > 0) {
        Toast.success(`${successCount} operação(ões) sincronizada(s)`);
      }
    } catch (e) {
      console.error('[SyncEngine] Push queue error:', e);
    } finally {
      _pushingQueue = false;
      this._updateStatusUI();
      this._updateBadge();
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DELTA SYNC — Only fetch what changed since last sync
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async _deltaSyncAll() {
    if (!this.online) return;
    for (const table of CONFIG.TABLES) {
      try {
        await this._deltaSyncTable(table);
      } catch (e) {
        console.warn(`[SyncEngine] Delta sync failed for ${table}:`, e.message);
      }
    }
  },

  async _deltaSyncTable(table) {
    const cursor = await DB.getCursor(table);
    let query = supabase.from(table).select('*');

    if (cursor) {
      // Delta: only records updated after our last sync
      query = query.gt('updated_at', cursor);
    }

    query = query.order('updated_at', { ascending: true });

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) return;

    // Apply each record with LWW conflict resolution
    let hasChanges = false;
    for (const serverRecord of data) {
      const localRecord = await DB.get(table, serverRecord.id);

      if (localRecord) {
        // LWW: compare updated_at timestamps
        const serverTime = new Date(serverRecord.updated_at).getTime();
        const localTime = new Date(localRecord.updated_at).getTime();

        if (serverTime >= localTime) {
          // Server wins — apply update
          if (serverRecord.is_deleted) {
            // Soft-deleted on server — remove from local cache
            await DB.delete(table, serverRecord.id);
          } else {
            await DB.put(table, serverRecord);
          }
          hasChanges = true;
        }
        // else: local is newer (pending push), skip server version
      } else {
        // New record from server
        if (!serverRecord.is_deleted) {
          await DB.put(table, serverRecord);
          hasChanges = true;
        }
      }
    }

    // Update cursor to the latest updated_at we received
    const latestTimestamp = data[data.length - 1].updated_at;
    await DB.setCursor(table, latestTimestamp);

    if (hasChanges) {
      this._notifySubscribers(table);
    }
  },

  /**
   * Full fetch — only used on first load when no cursor exists
   */
  async _fullFetchTable(table) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('is_deleted', false)
      .order('updated_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) {
      // Set cursor to now so delta sync works from here
      await DB.setCursor(table, new Date().toISOString());
      return;
    }

    await DB.clear(table);
    await DB.putAll(table, data);

    // Set cursor to latest record's updated_at
    const latestTimestamp = data[data.length - 1].updated_at;
    await DB.setCursor(table, latestTimestamp);

    this._notifySubscribers(table);
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUPABASE REALTIME — Debounced event handling
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  _setupRealtime() {
    // Subscribe to all tables via a single channel
    _realtimeChannel = supabase
      .channel('sync-engine-realtime')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        this._handleRealtimeEvent(payload);
      })
      .subscribe((status) => {
        console.log('[SyncEngine] Realtime status:', status);
      });
  },

  /**
   * Debounced handler for Realtime events.
   * Groups rapid-fire events per table to avoid UI thrashing.
   */
  _handleRealtimeEvent(payload) {
    const table = payload.table;
    if (!CONFIG.TABLES.includes(table)) return;

    // Clear existing debounce timer for this table
    clearTimeout(_realtimeDebounceTimers[table]);

    // Debounce: wait for burst to settle, then process
    _realtimeDebounceTimers[table] = setTimeout(async () => {
      try {
        const record = payload.new || payload.old;
        if (!record || !record.id) return;

        const eventType = payload.eventType; // INSERT | UPDATE | DELETE
        const localRecord = await DB.get(table, record.id);

        if (eventType === 'DELETE' || (record.is_deleted === true)) {
          // Remove from local cache
          if (localRecord) {
            await DB.delete(table, record.id);
            this._notifySubscribers(table);
          }
          return;
        }

        // INSERT or UPDATE — apply with LWW
        if (localRecord) {
          const serverTime = new Date(record.updated_at).getTime();
          const localTime = new Date(localRecord.updated_at).getTime();
          if (serverTime < localTime) return; // Local is newer, skip
        }

        await DB.put(table, record);

        // Update cursor if this record is newer
        const currentCursor = await DB.getCursor(table);
        if (!currentCursor || new Date(record.updated_at) > new Date(currentCursor)) {
          await DB.setCursor(table, record.updated_at);
        }

        this._notifySubscribers(table);
      } catch (e) {
        console.warn(`[SyncEngine] Realtime event error for ${table}:`, e);
      }
    }, CONFIG.REALTIME_DEBOUNCE);
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // UI STATUS — Passive, non-blocking indicators
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  _updateStatusUI(forceState) {
    const dot = document.getElementById('sync-dot');
    const lbl = document.getElementById('sync-label');
    const btn = document.getElementById('btn-sync');
    if (!dot || !lbl) return;

    const state = forceState || (_syncing || _pushingQueue ? 'syncing' : this.online ? 'online' : 'offline');

    switch (state) {
      case 'syncing':
        dot.className = 'sync-dot syncing';
        lbl.textContent = 'Sincronizando...';
        btn?.classList.add('syncing');
        break;
      case 'online':
        dot.className = 'sync-dot online';
        lbl.textContent = 'Online';
        btn?.classList.remove('syncing');
        break;
      default:
        dot.className = 'sync-dot offline';
        lbl.textContent = 'Offline';
        btn?.classList.remove('syncing');
    }
  },

  async _updateBadge() {
    const q = await DB.getQueue();
    const b = document.getElementById('sync-badge');
    if (!b) return;
    if (q.length > 0) {
      b.style.display = 'flex';
      b.textContent = q.length;
    } else {
      b.style.display = 'none';
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUBSCRIBER NOTIFICATION — Decoupled from render cycle
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  _notifySubscribers(table) {
    for (const sub of _subscribers) {
      if (sub.tables.includes(table) || sub.tables.includes('*')) {
        try {
          sub.callback({ table, source: 'sync' });
        } catch (e) {
          console.warn('[SyncEngine] Subscriber error:', e);
        }
      }
    }
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LEGACY COMPAT — pullAll for backward compatibility
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  async pullAll() {
    await this.initialLoad();
  },

  updateUI() {
    this._updateStatusUI();
  },

  async updateBadge() {
    await this._updateBadge();
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // CLEANUP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  destroy() {
    clearInterval(_deltaInterval);
    clearTimeout(_retryTimeout);
    Object.values(_realtimeDebounceTimers).forEach(clearTimeout);
    if (_realtimeChannel) {
      supabase.removeChannel(_realtimeChannel);
      _realtimeChannel = null;
    }
    _subscribers.clear();
  }
};
