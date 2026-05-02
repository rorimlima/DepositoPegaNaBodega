import Dexie from 'dexie';

export const db = new Dexie('DepositoPegaNaBodegaDB');

db.version(1).stores({
  empresa: 'id', // only one record usually
  clientes: 'id, nome, telefone', // id is string (UUID)
  produtos: 'id, codigo, nome, categoria', // preco_centavos, foto
  vendas: 'id, cliente_id, data_venda', 
  sync_queue: '++id, table, action, timestamp' // action: 'INSERT', 'UPDATE', 'DELETE'
});

export async function addToSyncQueue(table, action, data) {
  await db.sync_queue.add({
    table,
    action,
    data,
    timestamp: new Date().getTime(),
  });
}
