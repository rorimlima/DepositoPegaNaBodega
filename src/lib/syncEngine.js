import { db } from './db';
import { supabase, isSupabaseReady } from './supabase';

// ── Mapeamento: campo Dexie (local) → coluna Supabase (remota) ────────────────
const FIELD_MAPS = {
  produtos: {
    custo_centavos: 'custo_centavos',
    preco_centavos: 'preco_centavos',
    quantidade:     'quantidade',
    codigo:         'codigo',
    nome:           'nome',
    categoria:      'categoria',
    ativo:          'ativo',
  },
  empresa: {
    nome:       'nome',
    cnpj:       'cnpj',
    telefone:   'telefone',
    endereco:   'endereco',
    logoBase64: 'logoBase64',
  },
  clientes:  null,
  vendas:    null,
  usuarios:  null,
  comandas:  null,
};

function mapPayload(table, data) {
  const map = FIELD_MAPS[table];
  if (!map) return data;
  const result = {};
  for (const [key, val] of Object.entries(data)) {
    const mappedKey = map[key] ?? key;
    result[mappedKey] = val;
  }
  return result;
}

// ── Sync Status (usado pelo Header e outros) ─────────────────────────────────
let _syncStatus = { isSyncing: false, lastSync: null, lastError: null };
const _listeners = new Set();

export function getSyncStatus() {
  return { ..._syncStatus };
}

export function onSyncStatusChange(cb) {
  _listeners.add(cb);
  return () => _listeners.delete(cb);
}

function _notifyStatus(update) {
  _syncStatus = { ..._syncStatus, ...update };
  _listeners.forEach(cb => {
    try { cb(_syncStatus); } catch (_) {}
  });
}

// ── PUSH: Local → Supabase ───────────────────────────────────────────────────
export async function syncData() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, message: 'Offline' };
  if (!isSupabaseReady()) return { success: false, message: 'Supabase not configured' };

  try {
    const queue = await db.sync_queue.orderBy('timestamp').toArray();
    if (queue.length === 0) return { success: true, message: 'Up to date', count: 0 };

    let syncedCount = 0;

    for (const item of queue) {
      try {
        const { table, action, data, id } = item;
        const payload = mapPayload(table, data);

        if (action === 'INSERT' || action === 'UPDATE') {
          const { error } = await supabase.from(table).upsert(payload);
          if (error) throw error;
        } else if (action === 'DELETE') {
          const { error } = await supabase.from(table).delete().eq('id', data.id);
          if (error) throw error;
        }

        await db.sync_queue.delete(id);
        syncedCount++;
      } catch (err) {
        console.error(`[SyncEngine] Erro na tabela "${item.table}" | Ação "${item.action}":`, err?.message || err);
        // Pular itens com erro (não bloquear a fila inteira)
        // Se for 404 (tabela não existe no Supabase), pular
        if (err?.code === '42P01' || err?.message?.includes('404')) {
          await db.sync_queue.delete(item.id);
          continue;
        }
        break;
      }
    }

    return { success: true, count: syncedCount, remaining: queue.length - syncedCount };
  } catch (err) {
    console.error('[SyncEngine] Erro geral no push:', err);
    return { success: false, message: err?.message };
  }
}

// ── PULL: Supabase → Local ───────────────────────────────────────────────────
const PULL_TABLES = [
  { table: 'produtos',  dexieStore: 'produtos' },
  { table: 'clientes',  dexieStore: 'clientes' },
  { table: 'empresa',   dexieStore: 'empresa' },
  { table: 'usuarios',  dexieStore: 'usuarios' },
];

function normalizeNumericFields(row) {
  const numericFields = ['custo_centavos', 'preco_centavos', 'quantidade', 'total', 'total_centavos', 'preco_unitario', 'subtotal', 'valor'];
  const result = { ...row };
  for (const field of numericFields) {
    if (field in result && typeof result[field] === 'string') {
      result[field] = Number(result[field]);
    }
  }
  return result;
}

export async function pullFromSupabase() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, message: 'Offline' };
  if (!isSupabaseReady()) return { success: false, message: 'Supabase not configured' };

  let totalPulled = 0;

  for (const { table, dexieStore } of PULL_TABLES) {
    try {
      let query = supabase.from(table).select('*');
      if (['produtos', 'clientes', 'empresa', 'vendas', 'usuarios'].includes(table)) {
        query = query.eq('is_deleted', false);
      }

      const { data, error } = await query;

      if (error) {
        console.warn(`[Pull] Erro ao buscar ${table}:`, error.message);
        continue;
      }
      if (!data || data.length === 0) continue;

      console.log(`[Pull] ${table}: ${data.length} registros recebidos`);

      const store = db[dexieStore];
      if (!store) continue;

      for (const rawRow of data) {
        try {
          const row = normalizeNumericFields(rawRow);
          const existing = await store.get(row.id);
          if (!existing) {
            await store.put(row);
            totalPulled++;
          } else {
            const remoteUpdated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            const localUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
            if (remoteUpdated > localUpdated) {
              await store.put(row);
              totalPulled++;
            }
          }
        } catch (rowErr) {
          console.warn(`[Pull] Erro registro ${rawRow.id} em ${table}:`, rowErr?.message);
        }
      }
    } catch (err) {
      console.warn(`[Pull] Falha em ${table}:`, err?.message);
    }
  }

  console.log(`[Pull] ✅ ${totalPulled} registros sincronizados`);
  return { success: true, pulled: totalPulled };
}

// ── fullSync: Pull + Push combinados (chamado pelo Header e SyncBootstrap) ───
export async function fullSync() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, error: 'Offline' };
  if (!isSupabaseReady()) return { success: false, error: 'Supabase not configured' };

  _notifyStatus({ isSyncing: true, lastError: null });

  try {
    await db.open();

    // Pull primeiro (baixar dados do servidor)
    const pullResult = await pullFromSupabase();

    // Push depois (enviar mudanças locais)
    const pushResult = await syncData();

    const now = new Date().toISOString();
    _notifyStatus({ isSyncing: false, lastSync: now, lastError: null });

    return {
      success: true,
      pulled: pullResult.pulled || 0,
      pushed: pushResult.count || 0,
    };
  } catch (err) {
    const errorMsg = err?.message || 'Erro desconhecido';
    _notifyStatus({ isSyncing: false, lastError: errorMsg });
    console.error('[SyncEngine] ❌ fullSync error:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

// ── Auto Sync ────────────────────────────────────────────────────────────────
export function startAutoSync(intervalMs = 30000) {
  // Sync inicial ao abrir o app
  setTimeout(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine && isSupabaseReady()) {
      console.log('[SyncEngine] 🔄 Pull inicial...');
      try {
        await fullSync();
        console.log('[SyncEngine] ✅ Pull inicial concluído');
      } catch (err) {
        console.error('[SyncEngine] ❌ Erro no Pull inicial:', err);
      }
    }
  }, 2500);

  // Sync periódico
  setInterval(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine && isSupabaseReady()) {
      try {
        await fullSync();
      } catch (err) {
        console.error('[SyncEngine] Erro no sync periódico:', err);
      }
    }
  }, intervalMs);
}
