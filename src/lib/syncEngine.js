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

export async function syncData() {
  if (!navigator.onLine) return { success: false, message: 'Offline' };

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
}

export function startAutoSync(intervalMs = 30000) {
  // Sync inicial ao abrir o app
  setTimeout(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) syncData();
  }, 3000);

  // Sync periódico
  setInterval(() => {
    if (typeof navigator !== 'undefined' && navigator.onLine) syncData();
  }, intervalMs);
}
