import { db } from './db';
import { supabase } from './supabase';

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
  clientes:  null, // sem mapeamento especial — nomes iguais
  vendas:    null,
  usuarios:  null,
  comandas:  null,
};

function mapPayload(table, data) {
  const map = FIELD_MAPS[table];
  if (!map) return data;

  const result = {};
  for (const [key, val] of Object.entries(data)) {
    const mappedKey = map[key] ?? key; // usa o mapeamento ou o próprio nome
    result[mappedKey] = val;
  }
  return result;
}

// ── PUSH: Local → Supabase ───────────────────────────────────────────────────
export async function syncData() {
  if (typeof navigator === 'undefined' || !navigator.onLine) return { success: false, message: 'Offline' };

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
        break; // Interrompe na primeira falha para manter ordem
      }
    }

    return { success: true, count: syncedCount, remaining: queue.length - syncedCount };
  } catch (err) {
    console.error('[SyncEngine] Erro geral no push:', err);
    return { success: false, message: err?.message };
  }
}

// ── PULL: Supabase → Local (Download de dados existentes) ────────────────────
// Tabelas que devem ser puxadas do Supabase para popular o IndexedDB local
const PULL_TABLES = [
  { table: 'produtos',  dexieStore: 'produtos' },
  { table: 'clientes',  dexieStore: 'clientes' },
  { table: 'empresa',   dexieStore: 'empresa' },
  { table: 'usuarios',  dexieStore: 'usuarios' },
];

// Converte campos numéricos que vêm como string do Supabase
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
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    console.log('[Pull] Offline, skipping');
    return { success: false, message: 'Offline' };
  }

  let totalPulled = 0;

  for (const { table, dexieStore } of PULL_TABLES) {
    try {
      // Buscar todos os registros ativos do Supabase
      let query = supabase.from(table).select('*');

      // Nem todas as tabelas têm is_deleted
      if (['produtos', 'clientes', 'empresa', 'vendas', 'usuarios'].includes(table)) {
        query = query.eq('is_deleted', false);
      }

      const { data, error } = await query;

      if (error) {
        console.warn(`[Pull] Erro ao buscar ${table}:`, error.message, error.code, error.details);
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`[Pull] ${table}: 0 registros no Supabase`);
        continue;
      }

      console.log(`[Pull] ${table}: ${data.length} registros recebidos do Supabase`);

      // Acessar store do Dexie
      const store = db[dexieStore];
      if (!store) {
        console.warn(`[Pull] Store "${dexieStore}" não encontrada no Dexie`);
        continue;
      }

      // Processar cada registro
      for (const rawRow of data) {
        try {
          const row = normalizeNumericFields(rawRow);

          const existing = await store.get(row.id);
          if (!existing) {
            // Registro novo — inserir
            await store.put(row); // usar put ao invés de add para evitar erros de duplicata
            totalPulled++;
          } else {
            // Registro existe — atualizar se o remoto for mais recente
            const remoteUpdated = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            const localUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
            if (remoteUpdated > localUpdated) {
              await store.put(row);
              totalPulled++;
            }
          }
        } catch (rowErr) {
          console.warn(`[Pull] Erro ao processar registro ${rawRow.id} em ${table}:`, rowErr?.message || rowErr);
        }
      }

    } catch (err) {
      console.warn(`[Pull] Falha geral em ${table}:`, err?.message || err);
    }
  }

  console.log(`[Pull] ✅ Total sincronizado: ${totalPulled} registros`);
  return { success: true, pulled: totalPulled };
}

// ── Auto Sync (PULL + PUSH) ──────────────────────────────────────────────────
export function startAutoSync(intervalMs = 30000) {
  // Pull inicial ao abrir o app (baixar dados do Supabase)
  // Usar timeout maior para garantir que o DB está pronto
  setTimeout(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.log('[SyncEngine] 🔄 Iniciando Pull inicial...');
      try {
        await db.open(); // garante que o db está aberto
        await pullFromSupabase();
        await syncData();
        console.log('[SyncEngine] ✅ Pull inicial concluído');
      } catch (err) {
        console.error('[SyncEngine] ❌ Erro no Pull inicial:', err);
      }
    }
  }, 2500);

  // Sync periódico (push primeiro, depois pull)
  setInterval(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        await syncData();
        await pullFromSupabase();
      } catch (err) {
        console.error('[SyncEngine] Erro no sync periódico:', err);
      }
    }
  }, intervalMs);
}
