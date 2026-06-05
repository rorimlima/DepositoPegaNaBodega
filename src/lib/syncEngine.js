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
  clientes:            null,
  vendas:              null,
  usuarios:            null,
  comandas:            null,
  fechamentos_caixa:   null,
  movimentacoes_caixa: null,
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
          // Soft delete: marca is_deleted=true no Supabase em vez de deletar fisicamente.
          // Isso evita race condition onde o PULL reinsere o registro antes do DELETE ser processado.
          const { error } = await supabase.from(table)
            .update({ is_deleted: true, updated_at: new Date().toISOString() })
            .eq('id', data.id);
          if (error) throw error;
        }

        await db.sync_queue.delete(id);
        syncedCount++;
      } catch (err) {
        console.error(`[SyncEngine] Erro na tabela "${item.table}" | Ação "${item.action}":`, err?.message || err);
        
        // ── Tratamento Resiliente e Inteligente de Erros ───────────────────
        const isDbError = err?.code && err.code !== 'PGRST000'; // Códigos do Postgres (ex: 23505, 42703)
        const isClientError = err?.status && err.status >= 400 && err.status < 500; // 400 Bad Request, 403 Forbidden, 409 Conflict
        const isNotFoundError = err?.code === '42P01' || err?.message?.includes('404');
        
        if (isDbError || isClientError || isNotFoundError) {
          // Erro permanente do dado ou estrutura. Deletar da fila para não travar o sync subsequente.
          console.warn(`[SyncEngine] Removendo item ${item.id} de "${item.table}" por erro permanente no Supabase:`, err?.message || err);
          await db.sync_queue.delete(item.id);
          continue;
        }
        
        // Se for erro de rede/servidor temporário, para a execução (break) para tentar no próximo ciclo
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
  { table: 'produtos',           dexieStore: 'produtos' },
  { table: 'clientes',           dexieStore: 'clientes' },
  { table: 'empresa',            dexieStore: 'empresa' },
  { table: 'usuarios',           dexieStore: 'usuarios' },
  { table: 'vendas',             dexieStore: 'vendas' },
  { table: 'comandas',           dexieStore: 'comandas' },
  { table: 'fechamentos_caixa',  dexieStore: 'fechamentos_caixa' },
  { table: 'movimentacoes_caixa', dexieStore: 'movimentacoes_caixa' },
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

export async function pullFromSupabase({ force = false } = {}) {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, message: 'Offline' };
  if (!isSupabaseReady()) return { success: false, message: 'Supabase not configured' };

  let totalPulled = 0;

  for (const { table, dexieStore } of PULL_TABLES) {
    try {
      let query = supabase.from(table).select('*');
      // Filtrar registros marcados como excluídos no servidor
      const hasIsDeleted = ['produtos', 'clientes', 'empresa', 'vendas', 'usuarios', 'comandas', 'fechamentos_caixa', 'movimentacoes_caixa'].includes(table);
      if (hasIsDeleted) {
        query = query.eq('is_deleted', false);
      }

      const { data, error } = await query;

      if (error) {
        console.warn(`[Pull] Erro ao buscar ${table}:`, error.message);
        continue;
      }
      if (!data || data.length === 0) continue;

      console.log(`[Pull] ${table}: ${data.length} registros recebidos${force ? ' (FORCE)' : ''}`);

      const store = db[dexieStore];
      if (!store) continue;

      // Em modo force: coleta IDs remotos para detectar registros locais órfãos
      const remoteIds = force ? new Set() : null;

      for (const rawRow of data) {
        try {
          const row = normalizeNumericFields(rawRow);
          if (remoteIds) remoteIds.add(row.id);

          // ── Proteção contra reinserção de registros excluídos localmente ──
          // Verifica se existe um DELETE ou UPDATE com is_deleted pendente na sync_queue.
          // Isso cobre tanto exclusões diretas quanto cancelamentos (status: 'cancelada').
          const pendingDeleteOrSoftDelete = await db.sync_queue
            .where('table').equals(table)
            .filter(q => {
              if (q.data?.id !== row.id) return false;
              if (q.action === 'DELETE') return true;
              if (q.action === 'UPDATE' && q.data?.is_deleted === true) return true;
              return false;
            })
            .count();
          if (pendingDeleteOrSoftDelete > 0) {
            console.log(`[Pull] ⏭️ Ignorando ${row.id} de ${table} — exclusão pendente na fila local`);
            continue;
          }

          // ── Proteção adicional: se o registro local já está marcado como is_deleted,
          //    não sobrescrever com dados do servidor (o PUSH ainda vai processar)
          const existing = await store.get(row.id);
          if (existing?.is_deleted === true) {
            console.log(`[Pull] ⏭️ Ignorando ${row.id} de ${table} — marcado como is_deleted localmente`);
            continue;
          }

          if (!existing) {
            await store.put(row);
            totalPulled++;
          } else if (force) {
            // Force mode: sobrescreve com dados do servidor
            await store.put(row);
            totalPulled++;
          } else {
            // Modo normal: compara updated_at (com tolerância de 1s para timezone)
            const remoteUpdated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            const localUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
            if (remoteUpdated > localUpdated || (!localUpdated && remoteUpdated)) {
              await store.put(row);
              totalPulled++;
            }
          }
        } catch (rowErr) {
          console.warn(`[Pull] Erro registro ${rawRow.id} em ${table}:`, rowErr?.message);
        }
      }

      // Em modo force: remove registros locais que não existem mais no servidor
      // (registros com is_deleted=true no Supabase não vêm no pull, então seus IDs não estarão em remoteIds)
      if (force && remoteIds && hasIsDeleted) {
        try {
          const allLocal = await store.toArray();
          for (const local of allLocal) {
            if (!remoteIds.has(local.id)) {
              // Verificar se o registro local está na sync_queue antes de deletar
              const pendingSync = await db.sync_queue
                .where('table').equals(table)
                .filter(q => q.data?.id === local.id)
                .count();
              if (pendingSync === 0) {
                await store.delete(local.id);
                console.log(`[Pull Force] Removido registro local órfão ${local.id} de ${table}`);
              }
            }
          }
        } catch (cleanErr) {
          console.warn(`[Pull Force] Erro ao limpar órfãos de ${table}:`, cleanErr?.message);
        }
      }
    } catch (err) {
      console.warn(`[Pull] Falha em ${table}:`, err?.message);
    }
  }

  console.log(`[Pull] ✅ ${totalPulled} registros sincronizados${force ? ' (force)' : ''}`);
  return { success: true, pulled: totalPulled };
}

// ── fullSync: Pull + Push combinados (chamado pelo Header e SyncBootstrap) ───
export async function fullSync({ force = false } = {}) {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, error: 'Offline' };
  if (!isSupabaseReady()) return { success: false, error: 'Supabase not configured' };

  _notifyStatus({ isSyncing: true, lastError: null });

  try {
    await db.open();

    // Push primeiro em modo normal (enviar mudanças locais antes de puxar)
    const pushResult = await syncData();

    // Pull depois (baixar dados do servidor)
    const pullResult = await pullFromSupabase({ force });

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

// ── Login Sync: chamado imediatamente após autenticação ──────────────────────
// Faz push das mudanças locais pendentes e depois pull forçado do servidor
// para garantir que todos os dados estejam atualizados no dispositivo
export async function loginSync() {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    console.log('[SyncEngine] 📴 Login sync ignorado (offline)');
    return { success: false, error: 'Offline' };
  }
  if (!isSupabaseReady()) {
    console.log('[SyncEngine] ⚠️ Login sync ignorado (Supabase não configurado)');
    return { success: false, error: 'Supabase not configured' };
  }

  console.log('[SyncEngine] 🔐 Login sync iniciado (force pull)...');
  try {
    const result = await fullSync({ force: true });
    console.log(`[SyncEngine] 🔐 Login sync concluído — ${result.pulled || 0} registros atualizados, ${result.pushed || 0} enviados`);
    return result;
  } catch (err) {
    console.error('[SyncEngine] ❌ Login sync error:', err);
    return { success: false, error: err?.message };
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

// ── Sincronização Imediata ao Salvar (Hook do Dexie) ──────────────────────────
let _debounceTimeout = null;

export function triggerImmediateSync() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return;
  if (!isSupabaseReady()) return;
  
  if (_debounceTimeout) clearTimeout(_debounceTimeout);
  
  _debounceTimeout = setTimeout(async () => {
    try {
      console.log('[SyncEngine] ⚡ Disparando sincronização imediata por alteração de dados...');
      await syncData(); // Envia as alterações locais imediatamente em segundo plano
    } catch (e) {
      console.warn('[SyncEngine] Falha no sync imediato:', e);
    }
  }, 1000); // 1 segundo de delay (debounce)
}

// Registrar o hook na tabela sync_queue para observar novas inserções
if (typeof window !== 'undefined' && db && db.sync_queue) {
  try {
    db.sync_queue.hook('creating', function() {
      triggerImmediateSync();
    });
    console.log('[SyncEngine] ✅ Hook de sincronização imediata registrado com sucesso!');
  } catch (err) {
    console.warn('[SyncEngine] Não foi possível registrar o hook do Dexie:', err);
  }
}
