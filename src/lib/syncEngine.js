import { db } from './db';
import { supabase, isSupabaseReady } from './supabase';

// ── Configuração ────────────────────────────────────────────────────────────
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 15000]; // backoff exponencial (ms)
const SYNC_TABLES = ['empresa', 'clientes', 'produtos', 'vendas', 'usuarios'];

// ── Mapeamento: campo Dexie (local) → coluna Supabase (remota) ──────────────
const FIELD_MAPS = {
  produtos: {
    custo_centavos: 'custo_centavos',
    preco_centavos: 'preco_centavos',
    quantidade:     'quantidade',
    codigo:         'codigo',
    nome:           'nome',
    categoria:      'categoria',
    ativo:          'ativo',
    updated_at:     'updated_at',
  },
  empresa: {
    nome:       'nome',
    cnpj:       'cnpj',
    telefone:   'telefone',
    endereco:   'endereco',
    logoBase64: 'logo_base64',
    updated_at: 'updated_at',
  },
  vendas: {
    codigo:         'codigo',
    cliente_id:     'cliente_id',
    cliente_nome:   'cliente_nome',
    total_centavos: 'total_centavos',
    data_venda:     'data_venda',
    itens:          'itens',
    pagamentos:     'pagamentos',
    updated_at:     'updated_at',
  },
  clientes:  null, // sem mapeamento especial — nomes iguais
  usuarios:  null,
};

// Mapeamento reverso: Supabase → Dexie (para pull)
const REVERSE_FIELD_MAPS = {};
for (const [table, map] of Object.entries(FIELD_MAPS)) {
  if (!map) continue;
  REVERSE_FIELD_MAPS[table] = {};
  for (const [local, remote] of Object.entries(map)) {
    REVERSE_FIELD_MAPS[table][remote] = local;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapPayload(table, data) {
  const map = FIELD_MAPS[table];
  if (!map) return stripLocalFields(data);

  const result = {};
  for (const [key, val] of Object.entries(data)) {
    if (isLocalOnlyField(key)) continue;
    const mappedKey = map[key] ?? key;
    result[mappedKey] = val;
  }
  return result;
}

function reverseMapPayload(table, data) {
  const map = REVERSE_FIELD_MAPS[table];
  if (!map) return data;

  const result = {};
  for (const [key, val] of Object.entries(data)) {
    const localKey = map[key] ?? key;
    result[localKey] = val;
  }
  return result;
}

// Campos que só existem localmente e não devem ir pro Supabase
function isLocalOnlyField(key) {
  return ['senha', 'criado_em'].includes(key);
}

function stripLocalFields(data) {
  const result = { ...data };
  for (const field of ['senha', 'criado_em']) {
    delete result[field];
  }
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Status reativo — listeners podem se inscrever ───────────────────────────

let _syncStatus = {
  lastSync: null,
  lastError: null,
  isSyncing: false,
  pendingCount: 0,
  lastPush: null,
  lastPull: null,
};

const _listeners = new Set();

export function getSyncStatus() {
  return { ..._syncStatus };
}

export function onSyncStatusChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function updateStatus(partial) {
  _syncStatus = { ..._syncStatus, ...partial };
  _listeners.forEach(fn => {
    try { fn(_syncStatus); } catch (_) {}
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// PUSH — Local → Supabase
// ══════════════════════════════════════════════════════════════════════════════

export async function pushChanges() {
  if (!isSupabaseReady()) {
    console.warn('[SyncEngine] Supabase não configurado — push cancelado');
    return { success: false, message: 'Supabase não configurado' };
  }
  if (!navigator.onLine) {
    return { success: false, message: 'Offline' };
  }

  const queue = await db.sync_queue.orderBy('timestamp').toArray();
  if (queue.length === 0) {
    return { success: true, message: 'Nada para enviar', pushed: 0 };
  }

  let pushed = 0;
  let errors = 0;
  const failedItems = [];

  for (const item of queue) {
    try {
      const { table, action, data, id } = item;
      const retries = item.retries || 0;
      const payload = mapPayload(table, data);

      let error = null;

      if (action === 'INSERT' || action === 'UPDATE') {
        const res = await supabase.from(table).upsert(payload, { onConflict: 'id' });
        error = res.error;
      } else if (action === 'DELETE') {
        const res = await supabase.from(table).delete().eq('id', data.id);
        error = res.error;
      }

      if (error) {
        // Se é erro de tabela não existe ou RLS, loga e pula
        if (error.code === '42P01' || error.code === '42501' || error.code === 'PGRST116') {
          console.error(`[SyncEngine] Erro permanente em "${table}":`, error.message);
          await db.sync_queue.delete(id); // Remove da fila — não adianta retentar
          errors++;
          continue;
        }
        throw error;
      }

      // Sucesso — remove da fila
      await db.sync_queue.delete(id);
      pushed++;

    } catch (err) {
      const retries = (item.retries || 0) + 1;

      if (retries >= MAX_RETRIES) {
        // Máximo de retries — move para "dead letter" (remove da fila + loga)
        console.error(`[SyncEngine] ❌ Falha permanente após ${MAX_RETRIES} tentativas:`, {
          table: item.table, action: item.action, error: err?.message,
        });
        await db.sync_queue.delete(item.id);
        errors++;
        failedItems.push({ table: item.table, action: item.action, error: err?.message });
      } else {
        // Incrementa retry counter e continua com próximo item
        await db.sync_queue.update(item.id, { retries });
        console.warn(`[SyncEngine] ⚠️ Retry ${retries}/${MAX_RETRIES} para "${item.table}":`, err?.message);
      }
      // NÃO dá break — continua processando outros itens
    }
  }

  const remaining = await db.sync_queue.count();
  updateStatus({ pendingCount: remaining, lastPush: new Date().toISOString() });

  console.log(`[SyncEngine] Push: ${pushed} enviados, ${errors} erros, ${remaining} restantes`);
  return { success: errors === 0, pushed, errors, remaining, failedItems };
}

// ══════════════════════════════════════════════════════════════════════════════
// PULL — Supabase → Local
// ══════════════════════════════════════════════════════════════════════════════

export async function pullChanges() {
  if (!isSupabaseReady()) {
    console.warn('[SyncEngine] Supabase não configurado — pull cancelado');
    return { success: false, message: 'Supabase não configurado' };
  }
  if (!navigator.onLine) {
    return { success: false, message: 'Offline' };
  }

  let totalPulled = 0;
  const errors = [];

  for (const table of SYNC_TABLES) {
    try {
      // Pega timestamp do último pull desta tabela
      const meta = await db.sync_meta.get(table);
      const lastPull = meta?.last_pull || null;

      // Query incremental: só registros atualizados após último pull
      let query = supabase.from(table).select('*');
      if (lastPull) {
        query = query.gte('updated_at', lastPull);
      }

      const { data, error } = await query;

      if (error) {
        // Tabela pode não existir ainda — loga e continua
        if (error.code === '42P01' || error.code === 'PGRST116') {
          console.warn(`[SyncEngine] Tabela "${table}" não existe no Supabase — pulando pull`);
          continue;
        }
        throw error;
      }

      if (!data || data.length === 0) continue;

      // Upsert cada registro no Dexie local
      for (const remoteRecord of data) {
        const localRecord = reverseMapPayload(table, remoteRecord);

        // Verifica conflito: se o registro local foi modificado mais recentemente
        try {
          const existing = await db[table].get(localRecord.id);
          if (existing?.updated_at && localRecord.updated_at) {
            const localTime = new Date(existing.updated_at).getTime();
            const remoteTime = new Date(localRecord.updated_at).getTime();

            // Se local é mais recente, NÃO sobrescreve (ele será enviado no push)
            if (localTime > remoteTime) {
              continue;
            }
          }
        } catch (_) {
          // Registro não existe localmente — será criado abaixo
        }

        await db[table].put(localRecord);
        totalPulled++;
      }

      // Atualiza timestamp do último pull
      await db.sync_meta.put({
        table_name: table,
        last_pull: new Date().toISOString(),
      });

    } catch (err) {
      console.error(`[SyncEngine] Erro ao puxar "${table}":`, err?.message || err);
      errors.push({ table, error: err?.message });
    }
  }

  updateStatus({ lastPull: new Date().toISOString() });
  console.log(`[SyncEngine] Pull: ${totalPulled} registros atualizados, ${errors.length} erros`);
  return { success: errors.length === 0, pulled: totalPulled, errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// FULL SYNC — Push primeiro, depois Pull
// ══════════════════════════════════════════════════════════════════════════════

export async function fullSync() {
  if (_syncStatus.isSyncing) {
    console.log('[SyncEngine] Sync já em andamento — ignorando');
    return { success: false, message: 'Sync em andamento' };
  }

  updateStatus({ isSyncing: true, lastError: null });

  try {
    // 1. Push primeiro — envia mudanças locais
    const pushResult = await pushChanges();

    // 2. Pull depois — traz mudanças remotas
    const pullResult = await pullChanges();

    const pendingCount = await db.sync_queue.count();

    updateStatus({
      isSyncing: false,
      lastSync: new Date().toISOString(),
      pendingCount,
      lastError: null,
    });

    return {
      success: pushResult.success && pullResult.success,
      push: pushResult,
      pull: pullResult,
    };

  } catch (err) {
    updateStatus({
      isSyncing: false,
      lastError: err?.message || 'Erro desconhecido',
    });
    console.error('[SyncEngine] Erro no fullSync:', err);
    return { success: false, error: err?.message };
  }
}

// Alias para compatibilidade com código existente
export const syncData = fullSync;

// ══════════════════════════════════════════════════════════════════════════════
// AUTO SYNC — Timer + listener de reconexão
// ══════════════════════════════════════════════════════════════════════════════

let _autoSyncInterval = null;

export function startAutoSync(intervalMs = 30000) {
  // Limpa interval anterior (evita duplicação)
  if (_autoSyncInterval) clearInterval(_autoSyncInterval);

  // 1. Sync inicial com delay (espera a UI carregar)
  setTimeout(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fullSync().catch(console.error);
    }
  }, 3000);

  // 2. Sync periódico
  _autoSyncInterval = setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fullSync().catch(console.error);
    }
  }, intervalMs);

  // 3. Sync ao reconectar (evento online)
  if (typeof window !== 'undefined') {
    // Remove listener anterior se existir
    window.removeEventListener('online', _handleOnline);
    window.addEventListener('online', _handleOnline);
  }

  // 4. Atualiza contagem de pendentes
  _updatePendingCount();
}

function _handleOnline() {
  console.log('[SyncEngine] 🌐 Reconectou — iniciando sync...');
  // Pequeno delay para estabilizar a conexão
  setTimeout(() => fullSync().catch(console.error), 1500);
}

async function _updatePendingCount() {
  try {
    const count = await db.sync_queue.count();
    updateStatus({ pendingCount: count });
  } catch (_) {}
}

export function stopAutoSync() {
  if (_autoSyncInterval) {
    clearInterval(_autoSyncInterval);
    _autoSyncInterval = null;
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', _handleOnline);
  }
}
